const jspath = require('jspath')
const moment = require('moment-timezone')

const Award = require('../../Award')
const Flight = require('../../Flight')
const Parser = require('../../Parser')
const Segment = require('../../Segment')
const { cabins } = require('../../consts')
const { aircraft } = require('../../data')

// Cabin codes
const cabinCodes = {
  'E': cabins.economy,
  'P': cabins.premium,
  'B': cabins.business,
  'F': cabins.first
}

module.exports = class extends Parser {
  parse (results) {
    const { engine, query } = results
    const { quantity } = query
    const json = results.contents('json', 'results')

    // Get inbound and outbound flights
    const departures = this.getFlights(json, 0)
    const arrivals = this.getFlights(json, 1)

    // Transform flight data
    return [...departures, ...arrivals].map(f => {
      const segments = f.segment.map(x => {
        const departure = moment(x.departureDateTime, moment.ISO_8601, true)
        const arrival = moment(x.arrivalDateTime, moment.ISO_8601, true)
        return new Segment({
          airline: x.airline,
          flight: x.flightNo,
          aircraft: this.getAircraft(x.product),
          fromCity: x.origin,
          toCity: x.destination,
          date: departure,
          departure: departure,
          arrival: arrival,
          cabin: cabinCodes[x.cabin],
          stops: parseInt(x.stop),
          lagDays: parseInt(x.lagDays)
        })
      })

      const flight = new Flight(segments)
      return new Award({
        engine,
        fare: this.findFare(flight.highestCabin(), f.saver),
        quantity,
        mileageCost: f.startingMileage
      }, flight)
    })
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
    return result ? result.icao : iataCode
  }
}
