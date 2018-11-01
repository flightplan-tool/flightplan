const { DateTime } = require('luxon')

const Award = require('../../Award')
const Flight = require('../../Flight')
const Parser = require('../../Parser')
const Segment = require('../../Segment')
const { cabins } = require('../../consts')
const { aircraft } = require('../../data')
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
    const { isBlocking, message } = json
    if (isBlocking) {
      if (message.includes('We are unable to find recommendations')) {
        return []
      } else {
        throw new Parser.Error(message)
      }
    }

    // Get pricing info
    const { fares, tripFareMapper } = json

    // Get inbound and outbound flights
    const { outbound, inbound = [] } = json

    // Transform flight data
    const { engine } = results
    const awards = [...outbound, ...inbound].map(f => {
      const e = Object.entries(f.remainingSeatsByCabinClass)[0]
      const cabin = cabinClasses[e[0]]
      const quantity = e[1]

      // Get pricing info (may not always be available)
      const pricingInfo = {}
      const fareKeys = tripFareMapper[`${f.key}-${e[0]}`]
      if (fareKeys && fareKeys.length) {
        const fare = fares[fareKeys[0]]
        if (fare) {
          pricingInfo.mileageCost = fare.awardFare
          pricingInfo.fees = `${fare.fare} ${fare.currency}`
        }
      }
      const { mileageCost, fees } = pricingInfo

      // Create segments
      const segments = f.flights.map(x => {
        const departure = DateTime.fromISO(x.departure, { setZone: true })
        const arrival = DateTime.fromISO(x.arrival, { setZone: true })
        return new Segment({
          airline: x.airlineCode,
          flight: x.flightNumber,
          aircraft: this.getAircraft(x.aircraft),
          fromCity: x.departureAirportCode,
          toCity: x.destinationAirportCode,
          date: departure.toSQLDate(),
          departure: departure.toFormat('HH:mm'),
          arrival: arrival.toFormat('HH:mm'),
          lagDays: utils.days(departure, arrival),
          cabin,
          stops: x.stops
        })
      })

      // Create award
      return new Award({
        engine,
        fare: this.findFare(cabin),
        quantity,
        mileageCost,
        fees
      }, new Flight(segments))
    })

    // Return results
    return awards
  }

  getAircraft (iataCode) {
    const result = aircraft.find(x => x.iata === iataCode)
    return result ? result.icao : iataCode
  }
}
