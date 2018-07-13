const moment = require('moment')

const utils = require('../../shared/utils')

const configs = new Map()

module.exports = class {
  constructor (id, module, options) {
    const { engine: Engine, parser: Parser } = module

    // Setup config
    if (!configs.has(id)) {
      const config = typeof module.config === 'function' ? module.config(options) : {...module.config}
      config.id = id
      config.waitUntil = config.waitUntil || 'networkidle0'
      if (!('loginRequired' in config)) {
        config.loginRequired = Engine && !!(Engine.prototype.login || Engine.prototype.isLoggedIn)
      }
      if (!('oneWaySupported' in config)) {
        config.oneWaySupported = Engine && !!Engine.prototype.setOneWay
      }

      // Prevent further modification to the config, and cache it
      configs.set(id, utils.deepFreeze(config))
    }
    this.config = configs.get(id)

    // Separate engine and parser functions in separate namespaces
    this._engine = Engine ? new Engine(this) : undefined
    this._parser = Parser ? new Parser(this) : undefined
  }

  initialize (options) {
    if (!this._engine) {
      throw new Error(`Missing Engine implementation for: ${this.config.id}`)
    }
    return this._engine._initialize(options)
  }

  search (query) {
    if (!this._engine) {
      throw new Error(`Missing Engine implementation for: ${this.config.id}`)
    }
    const ret = this._engine._search(query)
    this._engine.lastError = ret.Error
    return ret
  }

  getCookies () {
    return (this._engine && this._engine.page) ? this._engine.page.cookies() : []
  }

  close () {
    if (this._engine) {
      return this._engine.close()
    }
  }

  parse (request) {
    if (!this._parser) {
      throw new Error(`Missing Parser implementation for: ${this.config.id}`)
    }
    return this._parser._parse(request)
  }

  validDateRange () {
    const { minDays, maxDays } = this.config.validation
    const now = moment().startOf('d')
    return [
      now.clone().add(minDays, 'd'),
      now.clone().add(maxDays, 'd')
    ]
  }
}
