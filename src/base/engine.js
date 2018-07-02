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

  async _initialize (options = {}) {
    this.options = options

    // Initialize throttling
    this.throttling = {}

    // Default locale to "en"
    moment.locale('en')

    // Setup browser
    this.browser = await this.newBrowser(options)

    // Create a new page
    this.page = await this.newPage(this.browser, options, this.config.searchURL)
    let ret

    // Get the page ready
    ret = await this.prepare(this.page)
    if (ret && ret.error) {
      throw new Error(ret.error)
    }

    // Login, and run implementation-specific initialization
    if (!await this._login()) {
      throw new Error(`Login failed`)
    }
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
      return true
    }

    let attempts = 0
    while (true) {
      let ret

      // Check whether we're logged in (or had too many attempts)
      const success = await this.isLoggedIn(page)
      if (success || attempts >= 4) {
        this.info(`Login ${success ? 'success' : 'failure'}!`)
        return success
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
        throw new Error(ret.error)
      }

      // Go to the search page (which will show us if we're logged in or not)
      await page.goto(searchURL, { waitUntil })

      // Get the page ready
      ret = await this.prepare(page)
      if (ret && ret.error) {
        throw new Error(ret.error)
      }
    }
  }

  async _search (query) {
    const { page, config } = this
    const { searchURL, waitUntil, oneWaySupported } = config

    // Store the query, so it can be accessed by the subclass
    this.query = query

    // Results will be stored by here, and populated by save()
    this.results = { responses: [], htmlFiles: [], screenshots: [], fileCount: 0 }
    let ret

    // Normalize the query
    query = this.normalizeQuery(query)

    // Validate the query
    ret = this.validQuery(query)
    if (ret && ret.error) {
      return ret
    }

    // Apply rate throttling
    await this.throttle()

    // Check if we should reload the search page
    if (!this.reloadSearch || await this.reloadSearch(page)) {
      await page.goto(searchURL, { waitUntil })
    }

    // Get the page ready
    ret = await this.prepare(page)
    if (ret && ret.error) {
      return ret
    }

    // Make sure we're still logged in
    if (!await this.isLoggedIn(page)) {
      ret = await this.login(page)
      if (ret && ret.error) {
        return ret
      }
    }

    // Setup the search form
    ret = await this.setup(page)
    if (ret && ret.error) {
      return ret
    }

    // Set Round-Trip or One-Way
    if (oneWaySupported) {
      ret = await this.setOneWay(page, query.oneWay)
      if (ret && ret.error) {
        return ret
      }
    }

    // Set origin and destination
    ret = await this.setFromCity(page, query.fromCity)
    if (ret && ret.error) {
      return ret
    }
    ret = await this.setToCity(page, query.toCity)
    if (ret && ret.error) {
      return ret
    }

    // Set departure and return dates
    ret = await this.setDepartDate(page, query.departDate)
    if (ret && ret.error) {
      return ret
    }
    if (query.returnDate) {
      ret = await this.setReturnDate(page, query.returnDate)
      if (ret && ret.error) {
        return ret
      }
    }

    // Set cabin
    ret = await this.setCabin(page, query.cabin)
    if (ret && ret.error) {
      return ret
    }

    // Set quantity
    ret = await this.setQuantity(page, query.quantity)
    if (ret && ret.error) {
      return ret
    }

    // Submit the form
    ret = await this.submit(page, query.htmlFile, query.screenshot)
    if (ret && ret.error) {
      return ret
    }

    // Success!
    return this.results
  }

  async newBrowser (options) {
    const { headless = false } = options
    return puppeteer.launch({ args: ['--use-gl'], headless })
  }

  async newPage (browser, options, url) {
    const page = await browser.newPage()
    page.setViewport({width: 1200, height: 1400})
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
}

module.exports = helpers(logging(Engine))
