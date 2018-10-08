const { DateTime } = require('luxon')

const Parser = require('../base/parser')
const { cabins } = require('../consts')
const { aircraft } = require('../data')

// Cabin classes
const cabinClasses = {
  'FIRST': cabins.first,
  'PRESTIGE': cabins.business,
  'ECONOMY': cabins.economy
}

module.exports = class extends Parser {
  parse (query, assets) {
    const json = assets.json.find(x => x.name === 'results').contents

    // Check for errors
    const { isBlocking, message } = json
    if (isBlocking) {
      if (message.includes('We are unable to find recommendations')) {
        return { awards: [] }
      } else {
        return { error: message }
      }
    }

    // Get pricing info
    const { fares, tripFareMapper } = json

    // Get inbound and outbound flights
    const { outbound, inbound = [] } = json

    // Transform flight data
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
          pricingInfo.mileage = fare.awardFare
          pricingInfo.fees = `${fare.fare} ${fare.currency}`
        }
      }
      const { mileage, fees } = pricingInfo

      return {
        cabin,
        fares: this.fares(cabin),
        fees,
        mileage,
        quantity,
        segments: f.flights.map(x => {
          const departure = DateTime.fromISO(x.departure, { setZone: true })
          const arrival = DateTime.fromISO(x.arrival, { setZone: true })
          return {
            airline: x.airlineCode,
            flight: x.flightNumber,
            aircraft: this.getAircraft(x.aircraft),
            fromCity: x.departureAirportCode,
            toCity: x.destinationAirportCode,
            date: departure.toSQLDate(),
            departure: departure.toFormat('HH:mm'),
            arrival: arrival.toFormat('HH:mm'),
            lagDays: this.computeLagDays(departure, arrival),
            cabin,
            stops: x.stops,
            bookingCode: x.bookingClass
          }
        })
      }
    })

    // Return results
    return { awards }
  }

  getAircraft (iataCode) {
    const result = aircraft.find(x => x.iata === iataCode)
    return result ? result.icao : iataCode
  }
}
