const fs = require('fs')
const moment = require('moment')
const puppeteer = require('puppeteer')

const applyEvasions = require('../../lib/evasions')
const { randomInt } = require('../../lib/utils')

class Engine {
  constructor () {
    // Don't allow base class to be instantiated
    if (new.target === Engine) {
      throw new TypeError('Base class Engine is abstract and cannot be instantiated directly')
    }

    // Check for existence of abstract methods
    const classMethods = [
      'config'
    ]
    const instanceMethods = [
      'initialize',
      'search'
    ]
    for (const method of classMethods) {
      if (this.constructor[method] === undefined) {
        throw new TypeError(`Engine subclass "${new.target.name}" is missing static method: ${method}()`)
      }
    }
    for (const method of instanceMethods) {
      if (this[method] === undefined) {
        throw new TypeError(`Engine subclass "${new.target.name}" is missing method: ${method}()`)
      }
    }

    // Initialize variables for throttling
    this.throttling = { start: moment(), requests: 0 }
  }

  // ============================================================
  // Static Methods
  // ============================================================

  static async new (options) {
    // Create an instance of the subclass
    const engine = new this(options)

    // Wait for it to initialize
    this.info('Initializing...')
    if (!await engine.initialize()) {
      this.error('Failed to initialize search engine!')
      return null
    }

    return engine
  }

  static get accountRequired () { return this.config.accountRequired }
  static get id () { return this.config.id }
  static get name () { return this.config.name }

  static info () {
    console.log(this.id + ':', ...arguments)
  }

  static error () {
    console.error(this.id + ':', ...arguments)
  }

  // ============================================================
  // Class Methods
  // ============================================================

  // Helper to access static method
  get config () { return this.constructor.config }
  get accountRequired () { return this.constructor.accountRequired }
  get id () { return this.constructor.id }
  get name () { return this.constructor.name }
  info () { return this.constructor.info(...arguments) }
  error () { return this.constructor.error(...arguments) }

  newBrowser (options) {
    // Launch the browser in headless mode and set up a page.
    return puppeteer.launch({
      args: ['--use-gl'],
      headless: options.headless
    })
  }

  async newPage (browser, options, url) {
    try {
      const page = await browser.newPage()
      page.setViewport({width: randomInt(1150, 1450), height: randomInt(850, 1050)})
      page.setDefaultNavigationTimeout(options.timeout)
      await applyEvasions(page)
      if (options.cookies) {
        await page.setCookie(...options.cookies)
      }
      if (url) {
        await page.goto(url, {waitUntil: 'networkidle2'})
      }
      return page
    } catch (e) {
      throw e
    }
  }

  async throttle () {
    try {
      const { requestsPerHour = 60, throttlePeriod = 30 * 60 } = this.config
      const limit = requestsPerHour / 3600 * throttlePeriod

      const { start, requests } = this.throttling
      if (requests >= limit) {
        // Sleep until end of period, to provide a cool-down period
        start.add(throttlePeriod, 's')
        const delayMillis = start.diff()
        if (delayMillis > 0) {
          console.log(`*** Cool-down period, resuming ${this._start.fromNow()} ***`)
          await this.page.waitFor(delayMillis)
        }
        this.throttling = { start: moment(), requests: 0 }
      }
      this.throttling.requests++
    } catch (e) {
      throw e
    }
  }

  async getCookies () {
    try {
      return await this.page.cookies()
    } catch (e) {
      return []
    }
  }

  async save (query, page) {
    try {
      const { screenshot, htmlFile } = query

      // Screenshot page if requested
      if (screenshot) {
        await page.screenshot({path: screenshot})
      }

      // Get the full HTML content and write it out
      const html = await page.evaluate(() => document.body.innerHTML)
      if (htmlFile) {
        fs.writeFileSync(htmlFile, html)
      }

      return html
    } catch (e) {
      throw e
    }
  }

  async close () {
    try {
      if (this.browser) {
        await this.browser.close()
        this.browser = null
      }
    } catch (e) {
      throw e
    }
  }
}

module.exports = Engine
