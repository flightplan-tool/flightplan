const { DateTime } = require('luxon')

const { defaults } = require('../consts')
const utils = require('../../shared/utils')

const configs = new Map()

module.exports = class {
  constructor (id, module) {
    const { engine: Engine, parser: Parser } = module

    // Setup config
    if (!configs.has(id)) {
      const config = { ...defaults.config, ...module.config }
      config.id = id
      if (!('loginRequired' in config)) {
        config.loginRequired = Engine && !!(Engine.prototype.login || Engine.prototype.isLoggedIn)
      }
      if (!('modifiable' in config)) {
        config.modifiable = (Engine && !!Engine.prototype.modify) ? [] : undefined
      }

      // Prevent further modification to the config, and cache it
      configs.set(id, utils.deepFreeze(config))
    }
    this.config = configs.get(id)

    // Separate engine and parser functions in separate namespaces
    this._engine = Engine ? new Engine(this) : undefined
    this._parser = Parser ? new Parser(this) : undefined
  }

  async initialize (options = {}) {
    if (!this._engine) {
      throw new Error(`Missing Engine implementation for: ${this.config.id}`)
    }
    await this._engine._initialize({ ...defaults.options, ...options })
  }

  async search (query) {
    if (!this._engine) {
      throw new Error(`Missing Engine implementation for: ${this.config.id}`)
    }

    let ret
    const { options } = this._engine
    try {
      // Run the search
      ret = await this._engine._search(query)
      this._engine.lastError = ret.error
      if (ret.error) {
        this._engine.error(ret.error)
      }
    } catch (err) {
      // Record the error that occurred
      this._engine.lastError = err
      throw err
    } finally {
      // Make sure at least one screenshot was saved
      const { results = {} } = this._engine
      if (query.screenshot) {
        if ((results.screenshots || []).length === 0) {
          await this._engine.screenshot()
        }
      }
    }

    // Parse search results
    if (ret && options.parse) {
      ret = { ...ret, ...this.parse(ret) }
    }

    return ret
  }

  async getCookies () {
    const cookies = (this._engine && this._engine.page)
      ? await this._engine.page.cookies()
      : []
    return cookies
  }

  async close () {
    if (this._engine) {
      await this._engine.close()
    }
  }

  parse (results) {
    // Normalize the query (in case parse() is being called separately from search)
    if (results.query) {
      results = { ...results, query: this.normalizeQuery(results.query) }
    }

    // Parse the results
    if (!this._parser) {
      throw new Error(`Missing Parser implementation for: ${this.config.id}`)
    }
    let ret = this._parser._parse(results)
    if (ret && ret.error) {
      this._parser.error(ret.error)
    }
    return ret
  }

  validDateRange () {
    const { minDays, maxDays } = this.config.validation
    const now = DateTime.local().startOf('day')
    return [
      now.plus({ days: minDays }),
      now.plus({ days: maxDays })
    ]
  }

  normalizeQuery (query) {
    // Create a copy first
    query = { ...query }

    // Ensure airport codes are uppercase
    query.fromCity = query.fromCity.toUpperCase()
    query.toCity = query.toCity.toUpperCase()

    // Ensure dates are in DateTime format
    query.departDate = this.normalizeDate(query.departDate)
    query.returnDate = this.normalizeDate(query.returnDate)

    // For convenience, compute if query is one-way
    query.oneWay = !query.returnDate

    // Default quantity to 1 if not specified
    if (query.quantity === undefined) {
      query.quantity = 1
    }

    // Freeze the query
    return Object.freeze(query)
  }

  normalizeDate (date) {
    return (date && typeof date === 'string') ? DateTime.fromSQL(date, { zone: 'utc' }) : date
  }

  // Logging functions forward to engine
  success () { this._engine.success(...arguments) }
  info () { this._engine.info(...arguments) }
  warn () { this._engine.warn(...arguments) }
  error () { this._engine.error(...arguments) }
}
