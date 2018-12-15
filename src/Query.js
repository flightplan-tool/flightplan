const moment = require('moment-timezone')
const timetable = require('timetable-fns')

const consts = require('./consts')
const utils = require('./utils')

const modifiable = Object.freeze([
  'partners',
  'cabin',
  'quantity',
  'fromCity',
  'toCity',
  'departDate',
  'returnDate',
  'oneWay',
  'quantity'
])

class Query {
  static get modifiable () {
    return modifiable
  }

  constructor (params) {
    // Read attributes and apply defaults
    const {
      partners = false,
      cabin,
      quantity = 1,
      fromCity,
      toCity,
      departDate: origDepartDate,
      returnDate: origReturnDate = null,
      json = {},
      html = {},
      screenshot = {}
    } = params

    // Coerce params
    const departDate = timetable.coerce(origDepartDate)
    const returnDate = timetable.coerce(origReturnDate)

    // Validate params
    if (!(cabin in consts.cabins)) {
      throw new Error(`Invalid query cabin: ${cabin}`)
    } else if (!utils.positiveInteger(quantity)) {
      throw new Error(`Invalid query quantity: ${quantity}`)
    } else if (!utils.validAirportCode(fromCity)) {
      throw new Error(`Invalid query fromCity: ${fromCity}`)
    } else if (!utils.validAirportCode(toCity)) {
      throw new Error(`Invalid query toCity: ${toCity}`)
    } else if (!utils.validDate(departDate)) {
      throw new Error(`Invalid query departDate: ${departDate}`)
    } else if (returnDate && !utils.validDate(returnDate)) {
      throw new Error(`Invalid query returnDate: ${returnDate}`)
    } else if (returnDate && returnDate < departDate) {
      throw new Error(`Invalid query date range: ${departDate} => ${returnDate}`)
    }

    // Set internal state
    this._state = {
      partners: !!partners,
      cabin,
      quantity,
      fromCity,
      toCity,
      departDate,
      returnDate,
      oneWay: !returnDate,
      json: Object.freeze({ ...json }),
      html: Object.freeze({ ...html }),
      screenshot: Object.freeze({ enabled: !!screenshot.path, ...screenshot })
    }
  }

  departDateMoment () {
    const { _state } = this
    if (!_state.hasOwnProperty('departDateMoment')) {
      _state.departDateMoment = moment(this.departDate)
    }
    return _state.departDateMoment.clone()
  }

  returnDateMoment () {
    const { _state } = this
    if (!_state.hasOwnProperty('returnDateMoment')) {
      _state.returnDateMoment = moment(this.returnDate)
    }
    return _state.returnDateMoment.clone()
  }

  closestDeparture (date) {
    return utils.closestYear(date, this._state.departDate)
  }

  closestReturn (date) {
    return utils.closestYear(date, this._state.returnDate)
  }

  diff (other) {
    if (!other) {
      return null
    }

    // Populate object with all keys whose values have changed
    const diff = modifiable
      .filter(key => this._state[key] !== other._state[key])
      .reduce((obj, key) => { obj[key] = this._state[key]; return obj }, {})

    // Return result
    return Object.keys(diff).length ? diff : null
  }

  toJSON () {
    const ret = { ...this._state }
    delete ret.departDateMoment
    delete ret.returnDateMoment
    delete ret.oneWay
    delete ret.json
    delete ret.html
    delete ret.screenshot
    return ret
  }

  toString () {
    return utils.ppJSON(this.toJSON())
  }

  get partners () {
    return this._state.partners
  }

  get fromCity () {
    return this._state.fromCity
  }

  get toCity () {
    return this._state.toCity
  }

  get departDate () {
    return this._state.departDate
  }

  get returnDate () {
    return this._state.returnDate
  }

  get oneWay () {
    return this._state.oneWay
  }

  get cabin () {
    return this._state.cabin
  }

  get quantity () {
    return this._state.quantity
  }

  get json () {
    return this._state.json
  }

  get html () {
    return this._state.html
  }

  get screenshot () {
    return this._state.screenshot
  }
}

module.exports = Query
