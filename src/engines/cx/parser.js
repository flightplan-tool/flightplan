const jspath = require('jspath')
const moment = require('moment-timezone')

const Award = require('../../Award')
const Flight = require('../../Flight')
const Parser = require('../../Parser')
const Segment = require('../../Segment')
const { cabins } = require('../../consts')
const { aircraft } = require('../../data')
const utils = require('../../utils')

// Cabin codes
const cabinCodes = {
  'E': cabins.economy,
  'R': cabins.economy,
  'N': cabins.premium,
  'B': cabins.business,
  'F': cabins.first
}

// Cabin and tier to fare code mapping
const tierId = { STD: 'S', PT1: '1', PT2A: '2' }
const cabinId = { [cabins.economy]: 'ECO', [cabins.premium]: 'PEY', [cabins.business]: 'BUS', [cabins.first]: 'FIR' }

module.exports = class extends Parser {
  parse (results) {
    const json = results.contents('json', 'results')

    // Check for empty results
    const { noFlights, pageBom } = json
    if (noFlights && pageBom && pageBom.length === 0) {
      return []
    }

    // Get airport codes
    const airports = this.airportCodes(json)

    // Get mileage info
    const { milesInfo } = json

    // Get flights
    const { engine } = results
    const flightData = jspath.apply(`.pageBom.modelObject.availabilities.upsell.bounds.flights`, json)
    const flights = flightData.map(f => {
      const { flightIdString } = f

      // Determine availability
      const availability = this.availabilityMap(f)
      if (availability.size === 0) {
        return null
      }

      // Build list of segments for this flight
      const segments = f.segments.map(x => {
        const flightId = x.flightIdentifier
        const airline = flightId.marketingAirline
        const fromCity = airports.get(x.originLocation)
        const toCity = airports.get(x.destinationLocation)

        // Calculate departure / arrival times
        const departure = moment.utc(flightId.originDate)
        const arrival = moment.utc(x.destinationDate)

        // Return the segment
        return new Segment({
          airline,
          flight: `${airline}${flightId.flightNumber}`,
          aircraft: this.findAircraft(x.equipment),
          fromCity,
          toCity,
          date: departure,
          departure: departure,
          arrival: arrival,
          stops: parseInt(x.numberOfStops),
          lagDays: utils.daysBetween(departure, arrival)
        })
      })

      // Determine partner status
      const partner = this.isPartner(segments, [ 'KA' ])

      // Parse flight ID
      const flightId = flightIdString.split('_')
      const tier = tierId[flightId[flightId.length - 2]]

      // Create an award for each cabin with availability
      const awards = []
      for (const [ cabin, data ] of availability) {
        // Find fare
        const fare = this.config.fares.find(x => x.cabin === cabin && x.code.endsWith(tier))
        if (!fare) {
          throw new Parser.Error(`Missing fare code: ${cabin} / ${tier}`)
        }

        // Get mileage cost
        if (milesInfo) {
          flightId[flightId.length - 1] = cabinId[cabin]
          const val = milesInfo[flightId.join('_')]
          if (val && val > 0) {
            data.mileageCost = val
          }
        }

        // Add the award
        awards.push(new Award({
          engine,
          partner,
          fare,
          ...data
        }))
      }

      // Create and return the flight
      return new Flight(segments, awards)
    }).filter(x => !!x)

    // Return results
    return flights
  }

  findAircraft (equipment) {
    const result = aircraft.find(x => x.iata === equipment)
    return result ? result.icao : equipment
  }

  availabilityMap (flight) {
    const { segments } = flight

    // Validate the flight info first
    if (segments.length === 0) {
      throw new Error(`Empty segments on flight: ${flight}`)
    }

    // Create map of availability for each segment
    const availability = new Map()
    for (const segment of segments) {
      jspath.apply(`.cabins.*`, segment).forEach(x => {
        // Validate code
        if (!cabinCodes[x.code]) {
          throw new Error(`Unrecognized cabin code: ${x.code}`)
        }

        // Validate status
        if (!['X', 'N', 'L'].includes(x.status) && Number.isNaN(parseInt(x.status))) {
          throw new Error(`Invalid cabin status: ${x.status}`)
        }

        // Update map
        let arr = availability.get(x.code)
        if (!arr) {
          arr = []
          availability.set(x.code, arr)
        }
        arr.push(x.status)
      })
    }

    // Convert mapping from codes to cabins
    const map = new Map()
    for (const [ code, values ] of availability) {
      const award = this.computeAward(segments, values)
      if (award) {
        const cabin = cabinCodes[code]
        award.cabins = segments.map(x => cabin)
        map.set(cabin, award)
      }
    }
    return map
  }

  computeAward (segments, values) {
    // Must have availability for every segment
    if (segments.length !== values.length) {
      return null
    }

    // Waitlisted flights with a partner segment are not bookable
    const partner = !!segments.find(x => {
      const airline = x.flightIdentifier.marketingAirline
      return !['CX', 'KA'].includes(airline)
    })
    if (partner && values.includes('L')) {
      return null
    }

    // Check for unavailable award
    if (values.includes('N') || values.includes('X')) {
      return null
    }

    // Check for waitlisted awards
    if (values.includes('L')) {
      const quantity = this.query.quantity
      return { quantity, exact: false, waitlisted: true }
    }

    // Compute numerical quantity
    const quantity = Math.min(...values.map(x => parseInt(x)))
    return { quantity, exact: true, waitlisted: false }
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
