const jspath = require('jspath')
const { DateTime } = require('luxon')

const Award = require('../../Award')
const Flight = require('../../Flight')
const Parser = require('../../Parser')
const Segment = require('../../Segment')
const { cabins } = require('../../consts')
const { aircraft } = require('../../data')
const utils = require('../../utils')

// Cabin codes
const cabinCodes = [
  { cabin: cabins.first, code: 'F' },
  { cabin: cabins.business, code: 'B' },
  { cabin: cabins.premium, code: 'R' },
  { cabin: cabins.economy, code: 'N' }
]

// Tier codes
const tierMap = {
  'STD': 'S',
  'PT1': '1',
  'PT2A': '2'
}

module.exports = class extends Parser {
  parse (results) {
    const json = results.contents('json', 'results')

    // Get airport codes
    const airports = this.airportCodes(json)

    // get pricing info
    const { milesInfo } = json

    // Get flights
    const { engine } = results
    const flights = jspath.apply(`.pageBom.modelObject.availabilities.upsell.bounds.flights`, json)
    const awards = flights.map(f => {
      const segments = f.segments.map(x => {
        const flightId = x.flightIdentifier
        const airline = flightId.marketingAirline
        const fromCity = airports.get(x.originLocation)
        const toCity = airports.get(x.destinationLocation)

        // Calculate departure / arrival times
        const departureUTC = DateTime.fromMillis(flightId.originDate, { zone: 'utc' })
        const arrivalUTC = DateTime.fromMillis(x.destinationDate, { zone: 'utc' })
        const departure = departureUTC.setZone(utils.airportTimeZone(fromCity), {keepLocalTime: true})
        const arrival = arrivalUTC.setZone(utils.airportTimeZone(toCity), {keepLocalTime: true})

        // Return the segment
        return new Segment({
          airline,
          flight: `${airline}${flightId.flightNumber}`,
          aircraft: this.findAircraft(x.equipment),
          fromCity,
          toCity,
          date: departure.toSQLDate(),
          departure: departure.toFormat('HH:mm'),
          arrival: arrival.toFormat('HH:mm'),
          cabin: this.highestCabin(x.cabins).cabin,
          stops: parseInt(x.numberOfStops),
          lagDays: utils.days(departure, arrival)
        })
      })

      // Create flight
      const flight = new Flight(segments)

      // Parse flight id string, to compute fare code
      const tierSuffix = tierMap[f.flightIdString.split('_').slice(-2)[0]]
      const cabin = flight.highestCabin()
      const fare = this.config.fares.find(x => x.cabin === cabin && x.code.endsWith(tierSuffix))

      // Calculate waitlist and quantity
      let quantity = Number.MAX_SAFE_INTEGER
      let waitlisted = false
      for (const segment of f.segments) {
        const { status } = this.highestCabin(segment.cabins)
        if (status === 'L') {
          waitlisted = true
          quantity = 0
        } else {
          quantity = Math.min(quantity, parseInt(status))
        }
      }
      quantity = (quantity > 0) ? quantity : results.query.quantity

      // Calculate mileage cost
      const mileageCost = (f.flightIdString in milesInfo) ? milesInfo[f.flightIdString] : null

      // Create and return award
      return new Award({
        engine,
        fare,
        quantity,
        waitlisted,
        mileageCost
      }, flight)
    })

    // Return results
    return awards
  }

  findAircraft (equipment) {
    const result = aircraft.find(x => x.iata === equipment)
    return result ? result.icao : equipment
  }

  highestCabin (cabins) {
    const { query } = this.results
    const start = cabinCodes.findIndex(x => x.cabin === query.cabin)
    for (const x of cabinCodes.slice(start)) {
      if (x.code in cabins) {
        return { cabin: x.cabin, ...cabins[x.code] }
      }
    }
  }

  airportCodes (json) {
    const map = new Map()
    const classNames = jspath.apply(`.pageBom.dictionaries.classNameDictionary`, json)[0]
    const locationIdx = Object.entries(classNames).find(x => x[1] === 'CXLocation')[0]
    const dict = jspath.apply(`.pageBom.dictionaries.values."${locationIdx}".*`, json)

    // Add airports
    jspath.apply(`.{.type === "A"}`, dict).forEach(entry => {
      map.set(entry.dictionaryKey, entry.code)
    })

    // Add terminals
    jspath.apply(`.{.type === "T"}`, dict).forEach(entry => {
      const parent = dict.find(x => x.dictionaryKey === entry.parent)
      map.set(entry.dictionaryKey, parent.code)
    })

    return map
  }
}
