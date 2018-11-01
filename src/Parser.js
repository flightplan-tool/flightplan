const logging = require('./logging')

class ParserError extends Error {}

class Parser {
  static get Error () {
    return ParserError
  }

  constructor (engine, config) {
    this._engine = engine
    this._config = config
  }

  findFare (cabin, saver = true) {
    return this._config.fares.find(x => x.cabin === cabin && x.saver === saver)
  }

  get id () {
    return this._engine
  }

  get config () {
    return this._config
  }

  get results () {
    return this._results
  }

  get query () {
    return this._results.query
  }

  _initialize (results) {
    this._results = results
  }
}

module.exports = logging(Parser)
