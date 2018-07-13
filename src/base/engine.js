const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const moment = require('moment')
const puppeteer = require('puppeteer')

const applyEvasions = require('../evasions')
const helpers = require('../helpers')
const logging = require('../logging')
const utils = require('../../shared/utils')

// Search can be in several states
const STATE_SEARCH = 'search'
const STATE_MODIFY = 'modify'

class Engine {
  constructor (parent) {
    this.parent = parent
    this.config = parent.config
  }

  async _initialize (options = {}) {
    this.options = options

    // Initialize throttling
    this.throttling = {}

    // Cache modifiable field set
    this.modifiable = new Set(this.config.modifiable || [])

    // Default locale to "en"
    moment.locale('en')

    // Setup browser and new page
    this.browser = await this.newBrowser(options)

    // Setup a new page
    this.page = await this.newPage(this.browser, options, this.config.searchURL)

    let ret

    // Get the page ready
    ret = await this.checkPage(true)
    if (ret && ret.error) {
      throw new Error(ret.error)
    }

    // Run implementation-specific initialization
    ret = await this.initialize(this.page)
    if (ret && ret.error) {
      throw new Error(ret.error)
    }

    return true
  }

  async _login () {
    const { page, config } = this
    const { loginRequired, searchURL, waitUntil } = config

    if (!loginRequired) {
      return {}
    }

    let attempts = 0
    while (true) {
      let ret

      // Check whether we're logged in (or had too many attempts)
      const success = await this.isLoggedIn(page)
      if (success || attempts >= 4) {
        this.info(`Login ${success ? 'success' : 'failure'}!`)
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
        this.info('4th and final login attempt...')
      }

      // Call implementation-specific login
      ret = await this.login(page)
      if (ret && ret.error) {
        return ret
      }

      // Go to the search page (which will show us if we're logged in or not)
      await page.goto(searchURL, { waitUntil })

      // Get the page ready
      ret = await this.prepare(page)
      if (ret && ret.error) {
        return ret
      }
    }
  }

  async checkPage () {
    const { page } = this
    let ret

    // Make sure page is ready to be used
    ret = await this.prepare(page)
    if (ret && ret.error) {
      return ret
    }

    // Make sure we're still logged in
    if (!await this.isLoggedIn(page)) {
      ret = await this._login()
      if (ret && ret.error) {
        return ret
      }
    }

    return {}
  }

  async _search (query) {
    const { page, config, lastError } = this
    const { searchURL, waitUntil } = config

    // Results will be stored by here, and populated by save()
    this.results = { responses: [], htmlFiles: [], screenshots: [], fileCount: 0 }
    let ret

    // Save the previous query
    this.prevQuery = lastError ? null : this.query

    // Normalize the query
    query = this.normalizeQuery(query)

    // Validate the query
    ret = this.validQuery(query)
    if (ret && ret.error) {
      return ret
    }

    // Apply rate throttling
    await this.throttle()

    // Attempt to modify the current search
    if (await this.modify(query)) {
      return this.results
    }

    // Reload search page
    await page.goto(searchURL, { waitUntil })
    ret = await this.checkPage()
    if (ret && ret.error) {
      return ret
    }

    // Fill out the form and submit
    this.state = STATE_SEARCH
    ret = await this.submitForm(query)
    if (ret && ret.error) {
      return ret
    }

    // Success!
    return this.results
  }

  async modify (query) {
    const { modifiable, prevQuery } = this
    let ret

    // Compute how the query has changed
    const diff = this.diffQuery(query, prevQuery)

    // Check if diff is valid, and engine supports this operation
    if (!diff || [...Object.keys(diff)].filter(x => !modifiable.has(x)).length > 0) {
      return false
    }

    // Make sure page is ready to use first
    ret = await this.checkPage()
    if (!ret || !ret.error) {
      // Attempt to modify and submit form
      this.state = STATE_MODIFY
      ret = await this.submitForm(diff)
    }

    // Check result
    if (ret && ret.error) {
      this.error(`Current search failed to be modified, resetting search state: ${ret.error}`)
      return false
    }

    // Operation was successful if we did not receive { modified: false }
    return !ret || ret.modified !== false
  }

  async submitForm (query) {
    const { page, config } = this
    const { oneWaySupported } = config
    const failed = () => ((ret && ret.error) || (ret && ret.modified === false))
    let ret

    // Setup the search form
    ret = await this.setup(page, query)
    if (failed()) {
      return ret
    }

    // Set Round-Trip or One-Way
    if (oneWaySupported && 'oneWay' in query) {
      ret = await this.setOneWay(page, query.oneWay)
      if (failed()) {
        return ret
      }
    }

    // Set origin and destination
    if (query.fromCity) {
      ret = await this.setFromCity(page, query.fromCity)
      if (failed()) {
        return ret
      }
    }
    if (query.toCity) {
      ret = await this.setToCity(page, query.toCity)
      if (failed()) {
        return ret
      }
    }

    // Set departure and return dates
    if (query.departDate) {
      ret = await this.setDepartDate(page, query.departDate)
      if (failed()) {
        return ret
      }
    }
    if (query.returnDate) {
      ret = await this.setReturnDate(page, query.returnDate)
      if (failed()) {
        return ret
      }
    }

    // Set cabin
    if (query.cabin) {
      ret = await this.setCabin(page, query.cabin)
      if (failed()) {
        return ret
      }
    }

    // Set quantity
    if (query.quantity) {
      ret = await this.setQuantity(page, query.quantity)
      if (failed()) {
        return ret
      }
    }

    // Submit the form
    const { htmlFile, screenshot } = this.query
    return this.submit(page, htmlFile, screenshot)
  }

  async newBrowser (options) {
    const { headless = false } = options
    return puppeteer.launch({ headless })
  }

  async newPage (browser, options, url) {
    const page = await browser.newPage()
    page.setViewport({width: utils.randomInt(1200, 1280), height: utils.randomInt(1400, 1440)})
    page.setDefaultNavigationTimeout(options.timeout)
    await applyEvasions(page)
    if (options.cookies) {
      await page.setCookie(...options.cookies)
    }
    if (url) {
      await page.goto(url, {waitUntil: this.config.waitUntil})
    }
    return page
  }

  async throttle () {
    let { lastRequest = null, checkpoint = null } = this.throttling
    const { delayBetweenRequests, requestsPerHour, restPeriod } = this.config.throttling

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
        this.warn(`Cool-down period, resuming ${checkpoint.until.fromNow()}`)
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

  async save (htmlFile, screenshot, index) {
    const { page, results } = this

    // If index not specified, determine it from # of responses so far
    index = (index !== undefined) ? index : results.responses.length

    // Update filenames based on index
    if (index > 0) {
      htmlFile = htmlFile ? utils.appendPath(htmlFile, '-' + index) : htmlFile
      screenshot = screenshot ? utils.appendPath(screenshot, '-' + index) : screenshot
    }

    // Screenshot page if requested
    if (screenshot) {
      await page.screenshot({path: screenshot})
      results.screenshots.push(screenshot)
    }

    // Get the full HTML content
    if (!await page.$('html')) {
      return { error: 'HTML element missing, invalid document' }
    }
    const html = await page.evaluate(() => document.querySelector('html').outerHTML)

    // Compress HTML and write to disk
    if (htmlFile) {
      try {
        const data = (path.extname(htmlFile) === '.gz') ? zlib.gzipSync(html) : html
        fs.writeFileSync(htmlFile, data)
        results.htmlFiles.push(htmlFile)
        results.fileCount++
      } catch (e) {
        return { error: `Failed to write HTML output to disk: ${e.message}` }
      }
    }

    // Append response
    results.responses.push(html)

    // Write to results whether it looks like we've been blocked
    results.blocked = this.isBlocked(html)

    return html
  }

  async close () {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  normalizeQuery (query) {
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
    return this.query
  }

  normalizeDate (date) {
    return (date && typeof date === 'string') ? moment(date) : date
  }

  validQuery (query) {
    const { fromCity, toCity, oneWay, departDate, returnDate } = query

    // One-way supported?
    if (oneWay && !this.config.oneWaySupported) {
      return { error: `One-way searches are not supported` }
    }

    // Validate from / to
    if (!this.validAirport(fromCity)) {
      return { error: `Invalid From city: ${fromCity}` }
    } else if (!this.validAirport(toCity)) {
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

    return {}
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
        return { error: `Received non-OK HTTP Status Code: ${response.status()}` }
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

  isModifying () {
    return this.state === STATE_MODIFY
  }
}

module.exports = helpers(logging(Engine))
