const timetable = require('timetable-fns')

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
      date: origDate,
      departure: origDeparture,
      arrival: origArrival,
      cabin = null,
      stops = 0,
      lagDays = 0
    } = attributes

    // Coerce attributes
    const date = timetable.coerce(origDate)
    const departure = timetable.coerceTime(origDeparture)
    const arrival = timetable.coerceTime(origArrival)

    // Validate attributes
    if (!utils.validFlightDesignator(flight)) {
      throw new Error(`Invalid segment flight designator: ${flight}`)
    } else if (!utils.validAirlineCode(airline)) {
      throw new Error(`Invalid segment airline: ${airline}`)
    } else if (!utils.validAirportCode(fromCity)) {
      throw new Error(`Invalid segment fromCity: ${fromCity}`)
    } else if (!utils.validAirportCode(toCity)) {
      throw new Error(`Invalid segment toCity: ${toCity}`)
    } else if (!utils.validDate(date)) {
      throw new Error(`Invalid segment date: ${date}`)
    } else if (!utils.validTime(departure)) {
      throw new Error(`Invalid segment departure: ${departure}`)
    } else if (!utils.validTime(arrival)) {
      throw new Error(`Invalid segment arrival: ${arrival}`)
    }

    // Set internal state
    this._state = {
      flight,
      airline,
      aircraft,
      fromCity,
      toCity,
      date,
      departure,
      arrival,
      stops,
      lagDays,
      key: `${date}:${fromCity}${toCity}:${flight}`
    }
    this._dynamic = { cabin }
  }

  static _clone (segment, cabin) {
    const instance = Object.create(this.prototype)
    instance._state = segment._state
    instance._dynamic = { ...segment._dynamic }
    return instance
  }

  key () {
    return this._state.key
  }

  departureMoment () {
    const { _state } = this
    if (!_state.hasOwnProperty('departureMoment')) {
      const { date, departure, fromCity } = this
      const tz = utils.airportTimezone(fromCity)
      const m = utils.dateTimeTz(date, departure, tz)
      if (!m.isValid()) {
        throw new Error(`Invalid departure date: ${date} ${departure} (airport: ${fromCity})`)
      }
      _state.departureMoment = m
    }
    return _state.departureMoment.clone()
  }

  arrivalMoment () {
    const { _state } = this
    if (!_state.hasOwnProperty('arrivalMoment')) {
      const { date, lagDays, arrival, toCity } = this
      const tz = utils.airportTimezone(toCity)
      const m = utils.dateTimeTz(timetable.plus(date, lagDays), arrival, tz)
      if (!m.isValid()) {
        throw new Error(`Invalid arrival date: ${date}(${lagDays}) ${arrival} (airport: ${toCity})`)
      }
      _state.arrivalMoment = m
    }
    return _state.arrivalMoment.clone()
  }

  toJSON () {
    const ret = { ...this._state }
    const { _dynamic } = this
    if (_dynamic.cabin) {
      ret.cabin = _dynamic.cabin
    }
    delete ret.key
    delete ret.departureMoment
    delete ret.arrivalMoment
    delete ret.duration
    delete ret.overnight
    return ret
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
    const { _state } = this
    if (!_state.hasOwnProperty('duration')) {
      const departure = this.departureMoment()
      const arrival = this.arrivalMoment()
      const duration = utils.duration(departure, arrival)
      if (duration < 0) {
        throw new Error(`Invalid segment duration: ["${departure}", "${arrival}"]`)
      }
      _state.duration = duration
    }
    return _state.duration
  }

  get nextConnection () {
    const { _dynamic } = this
    if (!_dynamic.hasOwnProperty('nextConnection')) {
      const { nextSegment } = _dynamic
      if (nextSegment) {
        const arrival = this.arrivalMoment()
        const departure = nextSegment.departureMoment()
        const connection = utils.duration(arrival, departure)
        if (connection < 0) {
          throw new Error(`Invalid segment nextConnection: ["${arrival}", "${departure}"]`)
        }
        _dynamic.nextConnection = connection
      } else {
        _dynamic.nextConnection = null
      }
    }
    return _dynamic.nextConnection
  }

  get cabin () {
    return this._dynamic.cabin
  }

  get stops () {
    return this._state.stops
  }

  get lagDays () {
    return this._state.lagDays
  }

  get overnight () {
    const { _state } = this
    if (!_state.hasOwnProperty('overnight')) {
      const { date, duration } = this
      const departure = this.departureMoment()
      const localArrival = departure.add(duration, 'minutes')
      _state.overnight = localArrival.hour() >= 1 &&
        timetable.diff(date, timetable.coerce(localArrival)) > 0
    }
    return _state.overnight
  }
}

module.exports = Segment
