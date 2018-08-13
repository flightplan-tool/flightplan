const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const moment = require('moment')
const puppeteer = require('puppeteer')

const applyEvasions = require('../evasions')
const helpers = require('../helpers')
const logging = require('../logging')
const utils = require('../../shared/utils')

class Engine {
  constructor (parent) {
    this.parent = parent
    this.config = parent.config
  }

  async _initialize (options) {
    const { modifiable } = this.config

    this.options = options

    // Initialize throttling
    this.throttling = {}

    // Cache modifiable field set
    this.modifiable = modifiable ? new Set(modifiable) : undefined

    // Default locale to "en"
    moment.locale('en')

    // Setup browser and new page
    this.browser = await this.newBrowser(options)

    // Setup a new page
    this.page = await this.newPage(this.browser, options)
  }

  _validate (query) {
    const { fromCity, toCity, oneWay, departDate, returnDate, cabin, quantity } = query

    // Validate from / to
    if (!this.validAirportCode(fromCity)) {
      return { error: `Invalid From city: ${fromCity}` }
    } else if (!this.validAirportCode(toCity)) {
      return { error: `Invalid To city: ${toCity}` }
    }

    // Validate dates
    const [ start, end ] = this.parent.validDateRange()
    const strValidRange = `${start.format('L')} - ${end.format('L')}`
    if (!departDate.isBetween(start, end, 'd', '[]')) {
      return { error: `Departure date (${departDate}) is outside valid search range: ${strValidRange}` }
    } else if (!oneWay && !returnDate.isBetween(start, end, 'd', '[]')) {
      return { error: `Return date (${returnDate}) is outside valid search range: ${strValidRange}` }
    }

    // Validate cabin
    const cabins = new Set([...this.config.fares.map(x => x.cabin)])
    if (!cabins.has(cabin)) {
      return { error: `Unsupported cabin: ${cabin}` }
    }

    // Validate quantity
    if (quantity < 1) {
      return { error: `Invalid quantity: ${quantity}` }
    }

    return this.validate(query)
  }

  async _login () {
    const { page, config, options } = this
    const { loginRequired, searchURL } = config

    if (!loginRequired) {
      return {}
    }

    let attempts = 0
    while (true) {
      let ret

      // Check whether we're logged in (or had too many attempts)
      const success = await this.isLoggedIn(page)
      if (success || attempts >= 4) {
        if (attempts > 0) {
          success ? this.success('Login succeeded') : this.error('Login failed')
        }
        return success ? {} : { error: 'Login failure' }
      }

      // Do another attempt
      attempts++
      if (attempts === 1) {
        this.info('Logging in...')
      } else if (attempts === 2) {
        this.info('2nd login attempt...')
      } else if (attempts === 3) {
        this.info('3rd login attempt...')
      } else if (attempts === 4) {
        this.warn('4th and final login attempt...')
      }

      // Call implementation-specific login
      ret = await this.login(page, options.credentials)
      if (ret && ret.error) {
        return ret
      }

      // Go to the search page (which will show us if we're logged in or not)
      ret = await this.goto(searchURL)
      if (ret && ret.error) {
        return ret
      }
    }
  }

  async _search (query) {
    const { page, config, lastError } = this
    const { searchURL } = config
    let ret

    // Results will be stored here
    this.results = {}

    // Save the previous query
    this.prevQuery = lastError ? null : this.query

    // Normalize the query
    query = this.normalizeQuery(query)

    // Validate the query
    ret = this._validate(query)
    if (ret && ret.error) {
      return ret
    }

    // Apply rate throttling
    await this.throttle()

    // Attempt to modify the current search
    ret = await this._modify(query)
    if (ret && (ret.error || ret.success)) {
      return ret
    }

    // Reload search page
    ret = this.goto(searchURL)
    if (ret && ret.error) {
      return ret
    }

    // Make sure we're logged-in
    ret = await this._login()
    if (ret && ret.error) {
      return ret
    }

    // Perform the search
    ret = await this.search(page, query)
    if (ret && ret.error) {
      return ret
    }

    // Success!
    return this.results
  }

  async _modify (query) {
    const { page, modifiable, prevQuery } = this

    // Does the engine support modification?
    if (!modifiable) {
      return { success: false }
    }

    // Compute how the query has changed
    const diff = this.diffQuery(query, prevQuery)

    // Check if diff is valid, and belongs to the modifiable subset
    if (!diff || [...Object.keys(diff)].filter(x => !modifiable.has(x)).length > 0) {
      return { success: false }
    }

    // Attempt to modify the search
    return this.modify(page, diff, query, prevQuery)
  }

  async newBrowser (options) {
    const { headless, args, proxy } = options
    if (proxy) {
      args.push(`--proxy-server=${proxy.server}`)
    }
    return puppeteer.launch({ headless, args })
  }

  async newPage (browser, options) {
    const page = await browser.newPage()

    // Set viewport size
    const { viewport = { width: utils.randomInt(1200, 1280), height: utils.randomInt(1400, 1440) } } = options
    page.setViewport(viewport)

    // Setup page
    page.setDefaultNavigationTimeout(options.timeout)
    await applyEvasions(page)

    // Authenticate proxy, if needed
    if (options.proxy) {
      const { username, password } = options.proxy
      if (username || password) {
        await page.authenticate({ username, password })
      }
    }

    // Set cookies if provided
    if (options.cookies) {
      await page.setCookie(...options.cookies)
    }

    return page
  }

  async goto (url) {
    const { waitUntil } = this.config
    try {
      const response = await this.page.goto(url, { waitUntil })
      return this.validResponse(response)
    } catch (err) {
      return { error: `goto(${url}): ${err.message}` }
    }
  }

  async throttle () {
    let { lastRequest = null, checkpoint = null } = this.throttling
    const { delayBetweenRequests, requestsPerHour, restPeriod } = this.config.throttling

    // Check if throttling is enabled
    if (!this.options.throttle) {
      return
    }

    // Insert delay between requests
    if (delayBetweenRequests && lastRequest) {
      const delay = utils.randomDuration(delayBetweenRequests)
      const delayMillis = lastRequest.clone().add(delay).diff()
      if (delayMillis > 0) {
        await this.page.waitFor(delayMillis)
      }
    }
    lastRequest = moment()

    // Check if we are at a resting checkpoint
    if (checkpoint && checkpoint.remaining <= 0) {
      const restMillis = checkpoint.until.diff()
      if (restMillis > 0) {
        this.info(`Cool-down period, resuming ${checkpoint.until.fromNow()}`)
        await this.page.waitFor(restMillis)
      }
      checkpoint = null
    }

    // If next resting checkpoint is unknown or past, compute new one
    if (!checkpoint || moment().isSameOrAfter(checkpoint.until)) {
      const dur = utils.randomDuration(restPeriod)
      checkpoint = {
        until: moment().add(dur),
        remaining: Math.max(1, Math.floor(requestsPerHour * dur.asMilliseconds() / (3600 * 1000)))
      }
    }

    // Update throttling state
    checkpoint.remaining--
    this.throttling = { lastRequest, checkpoint }
  }

  async saveJSON (name, contents) {
    return this.saveAsset('json', name, contents)
  }

  async saveHTML (name, contents = undefined) {
    // If no HTML provided, extract it from the page and take a screenshot
    if (contents === undefined) {
      this.screenshot(name)
      contents = await this.page.content()
    }

    return this.saveAsset('html', name, contents)
  }

  async screenshot (name = 'default') {
    return this.saveAsset('screenshot', name, null)
  }

  async saveAsset (type, name, contents) {
    const { page, results } = this
    const options = this.query[type] || {}
    const key = { html: 'html', json: 'json', screenshot: 'screenshots' }[type]

    try {
      const entry = { name, contents }

      if (options.path) {
        // Make path unique
        const index = (results[key] || []).length
        entry.path = (index > 0)
          ? utils.appendPath(options.path, '-' + index)
          : options.path

        // Convert contents to string
        if (type === 'json') {
          contents = JSON.stringify(contents)
        }

        // Write contents to disk
        switch (type) {
          case 'html':
          case 'json':
            // Compress contents
            if (options.gzip) {
              if (path.extname(entry.path) !== '.gz') {
                entry.path += '.gz'
              }
              contents = zlib.gzipSync(contents)
            }

            // Write to disk
            fs.writeFileSync(entry.path, contents)
            break
          case 'screenshot':
            entry.contents = await page.screenshot({...options, path: entry.path})
            break
        }
      }

      // Update results
      if (!results[key]) {
        results[key] = []
      }
      results[key].push(entry)
    } catch (err) {
      const strType = {html: 'HTML output', json: 'JSON output', screenshot: 'screenshot'}[type]
      return { error: `Failed to write ${strType} to disk: ${err.message}` }
    }
  }

  async close () {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  normalizeQuery (query) {
    // Ensure airport codes are uppercase
    query.fromCity = query.fromCity.toUpperCase()
    query.toCity = query.toCity.toUpperCase()

    // Ensure dates are in moment format
    query.departDate = this.normalizeDate(query.departDate)
    query.returnDate = this.normalizeDate(query.returnDate)

    // For convenience, compute if query is one-way
    query.oneWay = !query.returnDate

    // Default quantity to 1 if not specified
    if (query.quantity === undefined) {
      query.quantity = 1
    }

    // Freeze the query, and store it on this instance
    this.query = Object.freeze({...query})
    this.results.query = this.query
    return this.query
  }

  normalizeDate (date) {
    return (date && typeof date === 'string') ? moment(date) : date
  }

  validResponse (response) {
    // If no response, that's usually OK (data was likely pre-fetched)
    if (response) {
      // 304's (cached response) are OK too
      if (!response.ok() && response.status() !== 304) {
        // Trigger an immediate cool-down period
        const { checkpoint = null } = this.throttling
        if (checkpoint) {
          checkpoint.remaining = 0
        }

        // Return error message
        return { error: `Received non-OK HTTP Status Code: ${response.status()} (${response.url()})` }
      }
    }
    return {}
  }

  diffQuery (query, prevQuery) {
    if (!prevQuery) {
      return null
    }

    // Create a copy of query, and strip htmlFile and screenshot
    query = {...query}
    delete query.htmlFile
    delete query.screenshot

    // Populate object with all keys whose values have changed
    const diff = Object.keys(query)
      .filter(key => query[key] !== prevQuery[key])
      .reduce((obj, key) => { obj[key] = query[key]; return obj }, {})

    // Return result
    return Object.keys(diff).length ? diff : null
  }
}

module.exports = helpers(logging(Engine))
