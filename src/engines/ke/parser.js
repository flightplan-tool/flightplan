const moment = require('moment-timezone')

const Award = require('../../Award')
const Flight = require('../../Flight')
const Parser = require('../../Parser')
const Segment = require('../../Segment')
const { cabins } = require('../../consts')
const utils = require('../../utils')

// Cabin classes
const cabinClasses = {
  'FIRST': cabins.first,
  'PRESTIGE': cabins.business,
  'ECONOMY': cabins.economy
}

module.exports = class extends Parser {
  parse (results) {
    const json = results.contents('json', 'results')

    // Check for errors
    const { isBlocking, severity, message } = json
    if (isBlocking) {
      if (message.includes('unable to find recommendations') ||
        message.includes('unable to find departing flights')) {
        return []
      } else {
        throw new Parser.Error(`Website returned blocking error: ${message}`)
      }
    }
    if (severity === 'error') {
      throw new Parser.Error(`Website returned error: ${message}`)
    }

    // Get pricing info
    const { fares, tripFareMapper } = json

    // Get inbound and outbound flights
    const { outbound, inbound = [] } = json

    // Transform flight data
    const { engine } = results
    const flights = []
    for (const f of [...outbound, ...inbound]) {
      // Check availability per cabin
      const availability = new Map()
      for (const [ key, quantity ] of Object.entries(f.remainingSeatsByCabinClass)) {
        if (quantity === 0) {
          continue
        }

        // Record quantity and fare
        const cabin = cabinClasses[key]
        const info = { quantity, exact: true, fare: this.findFare(cabin) }
        availability.set(cabin, info)

        // Get pricing info (may not always be available)
        const fareKeys = tripFareMapper[`${f.key}-${key}`]
        if (fareKeys && fareKeys.length) {
          const fare = fares[fareKeys[0]]
          if (fare) {
            info.mileageCost = fare.awardFare
            info.fees = `${fare.fare} ${fare.currency}`
          }
        }
      }
      if (availability.size === 0) {
        continue // No availability for this flight
      }

      // Create segments
      const segments = f.flights.map(x => {
        const departure = moment.parseZone(x.departure)
        const arrival = moment.parseZone(x.arrival)
        return new Segment({
          airline: x.airlineCode,
          flight: x.flightNumber,
          aircraft: x.aircraft,
          fromCity: x.departureAirportCode,
          toCity: x.destinationAirportCode,
          date: departure,
          departure: departure,
          arrival: arrival,
          lagDays: utils.daysBetween(departure, arrival),
          stops: x.stops
        })
      })
      if (segments.length === 0) {
        throw new Parser.Error(`Flight had no segments: ${f}`)
      }

      // Determine partner status
      const partner = this.isPartner(segments)

      // Create awards
      const awards = []
      for (const [ cabin, info ] of availability) {
        awards.push(new Award({
          engine,
          partner,
          cabins: Array(segments.length).fill(cabin),
          fare: this.findFare(cabin),
          ...info
        }))
      }

      flights.push(new Flight(segments, awards))
    }

    // Return results
    return flights
  }
}
