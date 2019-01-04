const humanize = require('humanize-duration')
const puppeteer = require('puppeteer')

const Query = require('./Query')
const Results = require('./Results')
const Searcher = require('./Searcher')
const applyEvasions = require('./evasions')
const logging = require('./logging')
const utils = require('./utils')

const { errors } = Searcher

class Engine {
  constructor (id, module) {
    const { searcher: Searcher, config } = module

    // Verify existence of required lifecycle methods
    if (Searcher) {
      if (!Searcher.prototype.search) {
        const msg = 'No `search` method found on the defined Searcher, did you forget to override it?'
        throw new Error(`Searcher(${id}): ${msg}`)
      }
      if (config.modifiable.length > 0 && !Searcher.prototype.modify) {
        const msg = 'No `modify` method found on the defined Searcher, but `modifiable` fields were set on Config.'
        throw new Error(`Searcher(${id}): ${msg}`)
      }
    }

    // Save internal state
    this._state = {
      id,
      config,
      loginRequired: Searcher && !!(Searcher.prototype.login || Searcher.prototype.isLoggedIn),
      searcher: Searcher ? new Searcher(this) : undefined
    }
  }

  _verbose () {
    return ('verbose' in this._state) ? this._state.verbose : true
  }

  async initialize (options = {}) {
    const { searcher, id, config } = this._state
    if (!searcher) {
      throw new Error(`No Searcher subclass defined for engine: ${id}`)
    }

    // Initialize options with defaults
    const {
      credentials,
      args = [],
      headless = false,
      docker,
      width = utils.randomInt(1200, 1280),
      height = utils.randomInt(1400, 1440),
      proxy,
      throttle = true,
      timeout = 90000,
      verbose = true,
      cookies,
      evasions = {}
    } = options

    // Save options
    this._state = {
      ...this._state,
      throttling: throttle ? {} : undefined,
      modifiable: new Set(config.modifiable),
      credentials,
      args,
      headless,
      defaultViewport: { width, height },
      proxy,
      docker,
      timeout,
      verbose,
      cookies,
      evasions
    }

    // Setup browser and new page
    this._state.browser = await this._newBrowser()
    const page = (await this._state.browser.pages())[0]
    this._state.page = await this._newPage(page)

    // Make sure we can access the website
    await searcher.goto(config.searchURL, { referer: 'https://www.google.com/' })
    this._state.dirty = false
  }

  async search (query) {
    const { page, closed } = this._state

    // Make sure Engine in usable state
    if (closed) {
      throw new Error('Cannot call `search()` on a closed Engine.')
    } else if (!page) {
      throw new Error('Engine has not been initialized, did you forget to call `initialize()`?')
    }

    // Make sure query is validated
    if (!query || query.constructor.name !== 'Query') {
      query = new Query(query)
    }

    // Create a new Results
    const results = new Results(this, query)

    try {
      // Run the search
      await this._search(query, results)

      // Success! Save the query, for next time
      this._state.lastQuery = query
    } catch (err) {
      // Record the error that occurred
      this._state.lastError = err

      // Handle Searcher-specific errors differently
      if (err.name !== 'SearcherError') {
        throw err
      } else {
        results._setError(err)
        this.error(err)
      }
    } finally {
      // Make sure at least one screenshot was saved
      if (results.assets.screenshot.length === 0) {
        await results.screenshot()
      }
    }

    return results
  }

  async getCookies () {
    const { page } = this._state
    const cookies = page ? await page.cookies() : []
    return cookies
  }

  async close () {
    const { browser } = this._state
    if (browser) {
      await browser.close()
      this._state.browser = null
      this._state.page = null
      this._state.closed = true
    }
  }

  get id () {
    return this._state.id
  }

  get config () {
    return this._state.config
  }

  get loginRequired () {
    return this._state.loginRequired
  }

  get browser () {
    return this._state.browser
  }

  get page () {
    return this._state.page
  }

  set page (newPage) {
    this._state.page = newPage
  }

  async _newBrowser () {
    // Create a new browser
    const { headless, args, proxy, docker, defaultViewport } = this._state
    if (proxy) {
      args.push(`--proxy-server=${proxy.server}`)
    }
    if (docker) {
      args.push('--no-sandbox', '--headless', '--disable-dev-shm-usage')
    }
    const browser = await puppeteer.launch({ headless, args, defaultViewport })

    // Ensure that new tabs cannot be opened
    await browser.on('targetcreated', (target) => {
      if (target.type() === 'page') {
        target.page().then(page => page.close())
      }
    })

    return browser
  }

  async _newPage (page) {
    const { browser, timeout, proxy, cookies, evasions } = this._state

    // Create and setup the new page
    if (!page) {
      page = await browser.newPage()
    }
    page.setDefaultNavigationTimeout(timeout)

    // Authenticate proxy, if needed
    const { user, username, pass, password } = (proxy || {})
    if (user || username || pass || password) {
      await page.authenticate({ username: user || username, password: pass || password })
    }

    // Apply evasions
    await applyEvasions(page, evasions)

    // Set cookies if provided
    if (cookies) {
      await page.setCookie(...cookies)
    }

    return page
  }

  async login (retries = 3) {
    const { searcher, page, loginRequired, credentials } = this._state

    if (!loginRequired) {
      return true
    }

    let attempts = 0
    while (true) {
      // Reload search page
      await this._reload()

      // Check whether we're logged in (or had too many attempts)
      const success = await searcher.isLoggedIn(page)
      if (success || attempts >= retries) {
        if (attempts > 0) {
          success ? this.success('Login succeeded') : this.error('Login failed')
        }
        return success
      }

      // Do another attempt
      attempts++
      if (attempts === 1) {
        this.info('Logging in...')
      } else if (attempts === 2) {
        this.info('2nd login attempt...')
      } else if (attempts === 3) {
        this.info('3rd and final login attempt...')
      }

      // Call Searcher.login()
      this._state.dirty = true
      await searcher.login(page, credentials)
    }
  }

  async _search (query, results) {
    const { page, searcher } = this._state

    // Validate the query
    searcher.validate(query)

    // Apply rate throttling
    await this._throttle()

    // Attempt to modify the current search
    if (await this._modify(query, results)) {
      return
    }

    // Make sure we're logged in
    if (!(await this.login())) {
      throw new errors.LoginFailed()
    }

    // Reload search page
    await this._reload()

    // Call the Searcher
    this._state.dirty = true
    await searcher.search(page, query, results)
  }

  async _modify (query, results) {
    const { searcher, page, modifiable, lastError, lastQuery } = this._state

    // Does the engine support modification?
    if (modifiable.size === 0) {
      return false
    }

    // Compute how the query has changed
    const diff = query.diff(lastError ? null : lastQuery)

    // Check if diff is valid, and belongs to the modifiable subset
    if (!diff || [...Object.keys(diff)].filter(x => !modifiable.has(x)).length > 0) {
      return false
    }

    // Attempt to modify the search
    this._state.dirty = true
    return searcher.modify(page, diff, query, lastQuery, results)
  }

  async _throttle () {
    const { config, page, throttling } = this._state

    // Check if throttling is enabled
    if (!throttling) {
      return
    }

    let { lastRequest = null, checkpoint = null } = throttling
    const { delayBetweenRequests, requestsPerHour, restPeriod } = config.throttling

    // Insert delay between requests
    if (delayBetweenRequests && lastRequest) {
      const duration = utils.durationRange(delayBetweenRequests)
      const delay = lastRequest.add(duration).diff(utils.now(), 'ms')
      if (delay > 0) {
        await page.waitFor(delay)
      }
    }
    lastRequest = utils.now()

    // Check if we are at a resting checkpoint
    if (checkpoint && checkpoint.remaining <= 0) {
      const restMillis = checkpoint.until.diff(utils.now(), 'ms')
      if (restMillis > 0) {
        this.info(`Cool-down period, resuming in ${humanize(restMillis)}`)
        await page.waitFor(restMillis)
      }
      checkpoint = null
    }

    // If next resting checkpoint is unknown or past, compute new one
    const now = utils.now()
    if (!checkpoint || checkpoint.until.isBefore(now)) {
      const duration = utils.durationRange(restPeriod)
      checkpoint = {
        until: now.add(duration),
        remaining: Math.max(1, Math.floor(requestsPerHour * duration.valueOf() / (3600 * 1000)))
      }
    }

    // Update throttling state
    checkpoint.remaining--
    this._state.throttling = { lastRequest, checkpoint }
  }

  async _reload () {
    const { searcher, config } = this._state
    if (this._state.dirty) {
      await searcher.goto(config.searchURL)
      this._state.dirty = false
    }
  }
}

module.exports = logging(Engine)
