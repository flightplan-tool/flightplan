const logger = require('../shared/logger')

module.exports = (Base) => class extends Base {
  verbose () {
    return this._verbose()
  }

  success () {
    if (this.verbose()) {
      logger.success({ context: `[${this.id}]`, args: arguments })
    }
  }

  info () {
    if (this.verbose()) {
      logger.info({ context: `[${this.id}]`, args: arguments })
    }
  }

  warn () {
    if (this.verbose()) {
      logger.warn({ context: `[${this.id}]`, args: arguments })
    }
  }

  error () {
    if (this.verbose()) {
      logger.error({ context: `[${this.id}]`, args: arguments })
    }
  }
}
