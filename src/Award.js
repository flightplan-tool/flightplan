const consts = require('./consts')
const utils = require('./utils')

class Award {
  constructor (attributes, flight = null) {
    // Read attributes and apply defaults
    const {
      engine,
      partner = flight ? !flight.airlineMatches(engine) : false,
      cabins,
      fare: fareCode,
      quantity,
      exact = false,
      waitlisted = false,
      mileageCost = null,
      fees = null
    } = attributes

    // Validate fare first
    const fare = Award._validateFare(fareCode, engine)
    if (!fare) {
      throw new Error(`Invalid award fare: ${fareCode}`)
    }

    // Populate cabins from flight or fare code, if not defined
    let arrCabins
    if (cabins) {
      arrCabins = [...cabins]
    } else if (flight === null) {
      throw new Error(`Invalid award cabins: ${cabins} (cabins must be defined when no flight is given)`)
    } else {
      arrCabins = flight.segments.map(x => x.cabin || fare.cabin)
    }

    // Validate other attributes
    if (!utils.validAirlineCode(engine)) {
      throw new Error(`Invalid award engine: ${engine}`)
    }
    if (!Array.isArray(arrCabins) || arrCabins.length === 0) {
      throw new Error(`Invalid award cabins: ${arrCabins}`)
    }
    for (const cabin of arrCabins) {
      if (!(cabin in consts.cabins)) {
        throw new Error(`Invalid award cabin "${cabin}" found in cabins: ${arrCabins}`)
      }
    }
    if (flight && arrCabins.length !== flight.segments.length) {
      throw new Error(`Invalid award cabin: ${flight.segments.length} segments defined, but only ${arrCabins.length} cabins`)
    }
    if (!quantity || !utils.positiveInteger(quantity)) {
      throw new Error(`Invalid award quantity: ${quantity}`)
    }
    if (mileageCost && !utils.positiveInteger(mileageCost)) {
      throw new Error(`Invalid award mileageCost: ${mileageCost}`)
    }
    if (fees && !utils.validCurrency(fees)) {
      throw new Error(`Invalid award fees: ${fees}`)
    }

    // Calculate whether we have mixed cabins
    const mixedCabin = !arrCabins.every((val, i, arr) => val === arr[0])

    // Set internal state
    this._state = {
      engine,
      partner,
      cabins: Object.freeze(arrCabins),
      mixedCabin,
      fare,
      quantity,
      exact,
      waitlisted,
      mileageCost,
      fees
    }

    // Properly assign the flight this award
    if (flight) {
      flight._assignAward(this)
    }
  }

  static _validateFare (fareCode, engine) {
    if (!fareCode) {
      return null
    }

    // Get fares for this engine
    const module = Award._engines[engine.toLowerCase()]
    if (!module) {
      throw new Error(`No Engine defined for airline: ${engine}`)
    }
    const { fares } = module.config

    // If fare code is a string, get it's BookingClass
    if (typeof fareCode === 'string') {
      return fares.find(x => x.code === fareCode)
    }

    // Otherwise, make sure it belongs to this engine
    return (fares.indexOf(fareCode) >= 0) ? fareCode : null
  }

  toJSON (includeFlight = true) {
    const ret = { ...this._state }
    if (includeFlight) {
      ret.flight = ret.flight ? ret.flight.toJSON(false) : null
    } else {
      delete ret.flight
    }
    ret.cabins = [...ret.cabins]
    ret.fare = ret.fare.code
    delete ret.mixedCabin
    return ret
  }

  toString () {
    return utils.ppJSON(this.toJSON())
  }

  get flight () {
    return this._state.flight
  }

  get engine () {
    return this._state.engine
  }

  get partner () {
    return this._state.partner
  }

  get cabins () {
    return this._state.cabins
  }

  get mixedCabin () {
    return this._state.mixedCabin
  }

  get fare () {
    return this._state.fare
  }

  get quantity () {
    return this._state.quantity
  }

  get exact () {
    return this._state.exact
  }

  get waitlisted () {
    return this._state.waitlisted
  }

  get mileageCost () {
    return this._state.mileageCost
  }

  get fees () {
    return this._state.fees
  }
}

module.exports = Award
