const timetable = require('timetable-fns')

const Segment = require('./Segment')
const consts = require('./consts')
const utils = require('./utils')

class Flight {
  constructor (segments, awards = []) {
    // Double-check the array of segments
    if (!Array.isArray(segments) || segments.length === 0) {
      throw new Error(`Invalid flight segments: ${segments}`)
    }
    for (const segment of segments) {
      if (segment.constructor.name !== 'Segment') {
        throw new Error(`Invalid flight segment: ${segment}`)
      }
    }

    // Double check the array of awards
    if (!Array.isArray(awards)) {
      throw new Error(`Invalid flight awards: ${awards}`)
    }
    for (const award of awards) {
      if (award.constructor.name !== 'Award') {
        throw new Error(`Invalid flight award: ${award}`)
      }
    }
    awards = new Set(awards) // De-dupe awards

    // Clone the segments (so we have our own copy)
    segments = segments.map(x => Segment._clone(x, x._cabin))

    // For each segment, set the segment that follows it
    for (let i = 0; i < segments.length; i++) {
      const j = i + 1
      const next = (j < segments.length) ? segments[j] : null
      segments[i]._dynamic.nextSegment = next
      delete segments[i]._dynamic.nextConnection // Remove cached value
    }

    // Set state
    this._segments = Object.freeze([ ...segments ])
    this._state = { awards: Object.freeze([ ...awards ]) }

    // Each award needs to be assigned to this flight
    awards.forEach(x => this._assignAward(x))
  }

  static _clone (flight, award) {
    const instance = Object.create(this.prototype)
    const segments = flight._segments.map(
      (x, idx) => Segment._clone(x, award.cabins[idx]))
    instance._segments = Object.freeze(segments)
    instance._state = flight._state
    return instance
  }

  static _dedupe (flights) {
    // Dump flights in a map based on key
    const map = new Map()
    for (const flight of flights) {
      const key = flight.key()
      if (!map.has(key)) {
        map.set(key, new Set())
      }
      const set = map.get(key)
      set.add(flight)
    }

    // Verify that flights under the same key are truly identical
    flights = []
    const props = [
      'airline',
      'flight',
      'aircraft',
      'fromCity',
      'toCity',
      'date',
      'departure',
      'arrival',
      'stops',
      'lagDays'
    ]
    for (const key of [...map.keys()].sort()) {
      const arr = [...map.get(key)]
      const flight = new Flight(arr[0].segments)

      // Since the consolidated flight belongs to no award, null out cabin
      flight.segments.forEach(x => { x._cabin = null })

      // Compare each flight's segments
      const { segments } = flight
      for (let i = 1; i < arr.length; i++) {
        // Every flight must have the same number of segments
        if (arr[i].segments.length !== segments.length) {
          throw new Error(`Two flights with same key (${key}) had a segment length mismatch`)
        }

        // Compare all of the segment properties
        for (let j = 0; j < segments.length; j++) {
          if (segments[j]._state === arr[i].segments[j]._state) {
            continue // Absolute equality
          }
          props.forEach(prop => {
            if (segments[j][prop] !== arr[i].segments[j][prop]) {
              throw new Error(`Two flights with the same key (${key}) had a segment mismatch: ${segments[j]}, ${arr[i].segments[j]}`)
            }
          })
        }
      }

      // Collect all the awards for each identical flight
      const awardSet = new Set([].concat(...arr.map(x => x.awards)))
      flight._state.awards = Object.freeze([ ...awardSet ])
      awardSet.forEach(x => flight._assignAward(x))

      // Finally, add the consolidated flight
      flights.push(flight)
    }

    return flights
  }

  key () {
    const { _state, _segments: segments } = this
    if (!_state.hasOwnProperty('key')) {
      const date = segments[0].date
      const arr = [ segments[0].key() ]
      for (let i = 1; i < segments.length; i++) {
        const curr = segments[i]
        const days = timetable.diff(date, curr.date)
        arr.push(`${days}:${curr.fromCity}:${curr.flight}`)
      }
      _state.key = arr.join(':')
    }
    return _state.key
  }

  departureMoment () {
    const { _state, _segments: segments } = this
    if (!_state.hasOwnProperty('departureMoment')) {
      _state.departureMoment = segments[0].departureMoment()
    }
    return _state.departureMoment
  }

  arrivalMoment () {
    const { _state, _segments: segments } = this
    if (!_state.hasOwnProperty('arrivalMoment')) {
      _state.arrivalMoment = segments[segments.length - 1].arrivalMoment()
    }
    return _state.arrivalMoment
  }

  airlineMatches (airline) {
    return this._segments.every(x => x.airline === airline)
  }

  highestCabin () {
    const { first, business, premium, economy } = consts.cabins
    const ord = [ first, business, premium, economy ]
    const cabins = this._segments.map(x => x.cabin)
    return cabins.every(x => !!x)
      ? ord[Math.min(...cabins.map(x => ord.indexOf(x)))]
      : null
  }

  toJSON (includeAwards = true) {
    const ret = {}
    if (includeAwards) {
      ret.awards = this._state.awards.map(x => x.toJSON(false))
    }
    ret.segments = this._segments.map(x => x.toJSON())
    return ret
  }

  toString () {
    return utils.ppJSON(this.toJSON())
  }

  get awards () {
    return this._state.awards
  }

  get segments () {
    return this._segments
  }

  get fromCity () {
    const { _state, _segments: segments } = this
    if (!_state.hasOwnProperty('fromCity')) {
      _state.fromCity = segments[0].fromCity
    }
    return _state.fromCity
  }

  get toCity () {
    const { _state, _segments: segments } = this
    if (!_state.hasOwnProperty('toCity')) {
      _state.toCity = segments[segments.length - 1].toCity
    }
    return _state.toCity
  }

  get date () {
    const { _state, _segments: segments } = this
    if (!_state.hasOwnProperty('date')) {
      _state.date = segments[0].date
    }
    return _state.date
  }

  get departure () {
    const { _state, _segments: segments } = this
    if (!_state.hasOwnProperty('departure')) {
      _state.departure = segments[0].departure
    }
    return _state.departure
  }

  get arrival () {
    const { _state, _segments: segments } = this
    if (!_state.hasOwnProperty('arrival')) {
      _state.arrival = segments[segments.length - 1].arrival
    }
    return _state.arrival
  }

  get duration () {
    const { _state, _segments: segments } = this
    if (!_state.hasOwnProperty('duration')) {
      _state.duration = utils.duration(segments[0].departureMoment(), segments[segments.length - 1].arrivalMoment())
    }
    return _state.duration
  }

  get minLayover () {
    const { _state } = this
    if (!_state.hasOwnProperty('minLayover')) {
      const arr = this._layoverTimes()
      _state.minLayover = (arr.length > 0) ? Math.min(...arr) : null
    }
    return _state.minLayover
  }

  get maxLayover () {
    const { _state } = this
    if (!_state.hasOwnProperty('maxLayover')) {
      const arr = this._layoverTimes()
      _state.maxLayover = (arr.length > 0) ? Math.max(...arr) : null
    }
    return _state.maxLayover
  }

  get stops () {
    const { _state, _segments: segments } = this
    if (!_state.hasOwnProperty('stops')) {
      let sum = segments.length - 1
      for (const segment of segments) {
        sum += segment.stops
      }
      _state.stops = sum
    }
    return _state.stops
  }

  get lagDays () {
    const { _state, _segments: segments } = this
    if (!_state.hasOwnProperty('lagDays')) {
      const first = segments[0]
      const last = segments[segments.length - 1]
      _state.lagDays = timetable.diff(first.date, last.date) + last.lagDays
    }
    return _state.lagDays
  }

  get overnight () {
    const { _state, _segments: segments } = this
    if (!_state.hasOwnProperty('overnight')) {
      _state.overnight = !!segments.find(x => x.overnight)
    }
    return _state.overnight
  }

  _layoverTimes () {
    const { _segments: segments } = this
    return segments.map(x => x.nextConnection).filter(x => x !== null)
  }

  _assignAward (award) {
    const { flight } = award._state
    if (!flight || flight._state !== this._state) {
      // Remove the award from the old flight
      if (flight) {
        flight._removeAward(award)
      }

      // Now add the award to this flight
      const { awards } = this._state
      if (!awards.includes(award)) {
        this._state.awards = Object.freeze([ ...awards, award ])
      }
    }

    // Pass a light-weight copy of this flight to the award
    // (the segments are customized with the award's cabin assignments)
    award._state.flight = Flight._clone(this, award)
  }

  _removeAward (award) {
    const { awards } = this._state
    if (awards.includes(award)) {
      this._state.awards = Object.freeze(awards.filter(x => x !== award))
    }
  }
}

module.exports = Flight
