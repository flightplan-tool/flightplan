const jspath = require('jspath')
const { DateTime } = require('luxon')

const Parser = require('../base/parser')
const { cabins } = require('../consts')
const { aircraft } = require('../data')

// Cabin codes
const cabinCodes = {
  'E': cabins.economy,
  'P': cabins.premium,
  'B': cabins.business,
  'F': cabins.first
}

module.exports = class extends Parser {
  parse (query, assets) {
    const json = assets.json.find(x => x.name === 'results').contents

    // Get inbound and outbound flights
    const departures = this.getFlights(json, 0)
    const arrivals = this.getFlights(json, 1)

    // Transform flight data
    const awards = [...departures, ...arrivals].map(f => {
      const award = {
        mileage: f.startingMileage,
        duration: f.totalMinutes,
        segments: f.segment.map(x => {
          const departure = DateTime.fromISO(x.departureDateTime, { zone: 'utc' })
          const arrival = DateTime.fromISO(x.arrivalDateTime, { zone: 'utc' })
          return {
            airline: x.airline,
            flight: x.flightNo,
            aircraft: this.getAircraft(x.product),
            fromCity: x.origin,
            toCity: x.destination,
            date: departure.toSQLDate(),
            departure: departure.toFormat('HH:mm'),
            arrival: arrival.toFormat('HH:mm'),
            duration: this.parseDuration(x.duration),
            nextConnection: this.parseDuration(x.nextConnection),
            cabin: cabinCodes[x.cabin],
            stops: parseInt(x.stop),
            lagDays: parseInt(x.lagDays),
            bookingCode: x.bookClass
          }
        })
      }

      // Calculate award fare code
      award.cabin = this.bestCabin(award.segments)
      award.fares = this.config.fares.find(x => (x.cabin === award.cabin && x.saver === f.saver)).code + '+'

      return award
    })

    // Return results
    return { awards }
  }

  getFlights (json, index) {
    const fixed = this.getProduct(json, index, 'classic')
    const market = this.getProduct(json, index, 'classicPlus')
    fixed.forEach(x => { x.saver = true })
    market.forEach(x => { x.saver = false })
    return [...fixed, ...market]
  }

  getProduct (json, index, type) {
    return jspath.apply(
      `.NormalResults.product{.name === $type}.tripComponent{.position === $index}.ODoption`,
      json,
      { type: type, index: index }
    )
  }

  getAircraft (iataCode) {
    const result = aircraft.find(x => x.iata === iataCode)
    if (!result) {
      throw new Error(`Unrecognized aircraft IATA code: ${iataCode}`)
    }
    return result.icao
  }
}
