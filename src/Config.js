const timetable = require('timetable-fns')

const BookingClass = require('./BookingClass')
const Query = require('./Query')
const consts = require('./consts')
const utils = require('./utils')

class Config {
  constructor (settings) {
    // Read attributes and apply defaults
    const {
      name,
      homeURL,
      searchURL,
      waitUntil = 'networkidle0',
      validation = {},
      modifiable = [],
      throttling = consts.profiles.normal,
      fares
    } = settings

    const { minDays = 0, maxDays = 365 } = validation

    // Validate settings
    if (!utils.validURL(homeURL)) {
      throw new Error(`Invalid config homeURL: ${homeURL}`)
    } else if (!utils.validURL(searchURL)) {
      throw new Error(`Invalid config searchURL: ${searchURL}`)
    } else if (!utils.positiveInteger(minDays) && minDays !== 0) {
      throw new Error(`Invalid config validation: { minDays: ${minDays}, maxDays: ${maxDays} }`)
    } else if (!utils.positiveInteger(maxDays) && maxDays < minDays) {
      throw new Error(`Invalid config validation: { minDays: ${minDays}, maxDays: ${maxDays} }`)
    }

    // Validate modifiable fields
    if (!Array.isArray(modifiable)) {
      throw new Error(`Invalid config modifiable: ${modifiable}`)
    }
    modifiable.forEach(x => {
      if (!Query.modifiable.includes(x)) {
        throw new Error(`Invalid config modifiable field: ${x}`)
      }
    })

    // Ensure all fares are BookingClass instances
    if (!Array.isArray(fares)) {
      throw new Error(`Invalid config fares: ${fares}`)
    }
    fares.forEach((fare, idx) => {
      if (fare.constructor.name !== 'BookingClass') {
        fares[idx] = new BookingClass(fare)
      }
    })

    // Set internal state
    this._state = {
      name,
      homeURL,
      searchURL,
      waitUntil,
      validation: Object.freeze({ minDays, maxDays }),
      modifiable: Object.freeze([ ...modifiable ]),
      throttling: Object.freeze({ ...throttling }),
      fares: Object.freeze([ ...fares ])
    }
  }

  validDateRange () {
    const { minDays, maxDays } = this._state.validation
    const now = timetable.today()
    return [
      timetable.plus(now, minDays),
      timetable.plus(now, maxDays)
    ]
  }

  toJSON () {
    const ret = { ...this._state }
    ret.validation = { ...this._state.validation }
    ret.modifiable = [ ...this._state.modifiable ]
    ret.throttling = { ...this._state.throttling }
    ret.fares = this._state.fares.map(x => x.toJSON())
    return ret
  }

  toString () {
    return utils.ppJSON(this.toJSON())
  }

  get name () {
    return this._state.name
  }

  get homeURL () {
    return this._state.homeURL
  }

  get searchURL () {
    return this._state.searchURL
  }

  get waitUntil () {
    return this._state.waitUntil
  }

  get validation () {
    return this._state.validation
  }

  get modifiable () {
    return this._state.modifiable
  }

  get throttling () {
    return this._state.throttling
  }

  get fares () {
    return this._state.fares
  }
}

module.exports = Config
