const logger = require('../shared/logger')

module.exports = (Base) => class extends Base {
  verbose () {
    const { verbose = true } = this.options || {}
    return verbose
  }

  success () {
    if (this.verbose()) {
      logger.success({ context: `[${this.id}]`, arguments })
    }
  }

  info () {
    if (this.verbose()) {
      logger.info({ context: `[${this.id}]`, arguments })
    }
  }

  warn () {
    if (this.verbose()) {
      logger.warn({ context: `[${this.id}]`, arguments })
    }
  }

  error () {
    if (this.verbose()) {
      logger.error({ context: `[${this.id}]`, arguments })
    }
  }
}
