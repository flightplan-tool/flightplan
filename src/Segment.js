const utils = require('./utils')

class Segment {
  constructor (attributes) {
    // Read attributes and apply defaults
    const {
      flight,
      airline = flight.slice(0, 2),
      aircraft = null,
      fromCity,
      toCity,
      date,
      departure,
      arrival,
      cabin = null,
      stops = 0,
      lagDays = 0
    } = attributes

    // Validate attributes
    if (!utils.validFlightDesignator(flight)) {
      throw new Error(`Invalid segment flight designator: ${flight}`)
    } else if (!utils.validAirlineCode(airline)) {
      throw new Error(`Invalid segment airline: ${airline}`)
    } else if (!utils.validAirportCode(fromCity)) {
      throw new Error(`Invalid segment fromCity: ${fromCity}`)
    } else if (!utils.validAirportCode(toCity)) {
      throw new Error(`Invalid segment toCity: ${toCity}`)
    } else if (!utils.validTime(departure)) {
      throw new Error(`Invalid segment departure: ${departure}`)
    } else if (!utils.validTime(arrival)) {
      throw new Error(`Invalid segment arrival: ${arrival}`)
    }

    // Determine source and destination time zones
    const fromCityTZ = utils.airportTimeZone(fromCity)
    const toCityTZ = utils.airportTimeZone(toCity)

    // Parse date, so we can determine it's validity
    const departureDate = utils.parseDate(date, fromCityTZ)
    const arrivalDate = utils.parseDate(date, toCityTZ).plus({ days: lagDays })

    if (!departureDate.isValid) {
      throw new Error(`Invalid segment date: ${date} (tz: ${fromCityTZ})`)
    }
    if (!arrivalDate.isValid) {
      throw new Error(`Invalid segment lagDays: ${lagDays} (date: ${date}, tz: ${toCityTZ})`)
    }

    // Calculate departure and arrival times, so we can get segment duration
    const departureObject = utils.joinDateTime(departureDate, utils.parseTime(departure))
    const arrivalObject = utils.joinDateTime(arrivalDate, utils.parseTime(arrival))
    const duration = utils.duration(departureObject, arrivalObject)
    if (duration < 0) {
      throw new Error(`Invalid segment duration: ["${departureObject}", "${arrivalObject}"]`)
    }

    // Calculate whether segment is overnight
    const localArrival = departureObject.plus({ minutes: duration })
    const overnight = localArrival.hour >= 1 && utils.days(departureDate, localArrival) > 0

    // Set internal state
    this._state = {
      flight,
      airline,
      aircraft,
      fromCity,
      toCity,
      date: departureDate.toSQLDate(),
      dateObject: departureDate,
      departure,
      departureObject,
      arrival,
      arrivalObject,
      duration,
      nextConnection: null,
      stops,
      lagDays,
      overnight
    }
    this._state.key = `${this.date}:${this.fromCity}:${this.flight}`
    this._cabin = cabin
  }

  static _clone (segment, cabin) {
    const instance = Object.create(this.prototype)
    instance._state = segment._state
    instance._cabin = cabin
    return instance
  }

  key () {
    return this._state.key
  }

  dateObject () {
    return this._state.dateObject
  }

  departureObject () {
    return this._state.departureObject
  }

  arrivalObject () {
    return this._state.arrivalObject
  }

  toJSON () {
    const ret = { ...this._state }
    ret.cabin = this._cabin
    delete ret.key
    delete ret.dateObject
    delete ret.departureObject
    delete ret.arrivalObject
  }

  toString () {
    return utils.ppJSON(this.toJSON())
  }

  get airline () {
    return this._state.airline
  }

  get flight () {
    return this._state.flight
  }

  get aircraft () {
    return this._state.aircraft
  }

  get fromCity () {
    return this._state.fromCity
  }

  get toCity () {
    return this._state.toCity
  }

  get date () {
    return this._state.date
  }

  get departure () {
    return this._state.departure
  }

  get arrival () {
    return this._state.arrival
  }

  get duration () {
    return this._state.duration
  }

  get nextConnection () {
    return this._state.nextConnection
  }

  get cabin () {
    return this._cabin
  }

  get stops () {
    return this._state.stops
  }

  get lagDays () {
    return this._state.lagDays
  }

  get overnight () {
    return this._state.overnight
  }
}

module.exports = Segment
