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
      departDate,
      returnDate = null,
      json = {},
      html = {},
      screenshot = {}
    } = params

    // Validate params
    if (!(cabin in consts.cabins)) {
      throw new Error(`Invalid query cabin: ${cabin}`)
    } else if (!utils.positiveInteger(quantity)) {
      throw new Error(`Invalid query quantity: ${quantity}`)
    } else if (!utils.validAirportCode(fromCity)) {
      throw new Error(`Invalid query fromCity: ${fromCity}`)
    } else if (!utils.validAirportCode(toCity)) {
      throw new Error(`Invalid query toCity: ${toCity}`)
    }

    // Parse dates so we can determine their validity
    const departDateObject = utils.parseDate(departDate)
    const returnDateObject = returnDate ? utils.parseDate(returnDate) : null
    if (!departDateObject.isValid) {
      throw new Error(`Invalid query departDate: ${departDate}`)
    } else if (returnDate && !returnDateObject.isValid) {
      throw new Error(`Invalid query returnDate: ${returnDate}`)
    }

    // Set internal state
    this._state = {
      partners: !!partners,
      cabin,
      quantity,
      fromCity,
      toCity,
      departDate: departDateObject.toSQLDate(),
      departDateObject,
      returnDate: returnDateObject ? returnDateObject.toSQLDate() : null,
      returnDateObject,
      oneWay: !returnDateObject,
      json: Object.freeze({ ...json }),
      html: Object.freeze({ ...html }),
      screenshot: Object.freeze({ enabled: !!screenshot.path, ...screenshot })
    }
  }

  departDateObject () {
    return this._state.departDateObject
  }

  returnDateObject () {
    return this._state.returnDateObject
  }

  closestDeparture (date) {
    return utils.setNearestYear(this._state.departDateObject, date)
  }

  closestReturn (date) {
    return utils.setNearestYear(this._state.returnDateObject, date)
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
    delete ret.departDateObject
    delete ret.returnDateObject
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
