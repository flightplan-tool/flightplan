const jspath = require('jspath')

const Parser = require('../base/parser')
const { cabins } = require('../consts')

// Cabin codes
const cabinCodes = {
  'E': cabins.economy,
  'P': cabins.premium,
  'B': cabins.business,
  'F': cabins.first
}

// Certain aircraft codes that are lacking proper description
const aircraftCodes = {
  '319': 'Airbus 319',
  '320': 'Airbus 320',
  '321': 'Airbus 321',
  '333': 'Airbus A330-300',
  '346': 'Airbus A340-600',
  '388': 'Airbus A380-800',
  '738': 'Boeing 737-800',
  '777': 'Boeing 777',
  '788': 'Boeing 787-8',
  '789': 'Boeing 787-9',
  '7M8': 'Boeing 737 MAX 8',
  '77W': 'Boeing 777-300ER',
  '32A': 'Airbus A320neo',
  'CS1': 'Airbus A220-100',
  'CS3': 'Airbus A220-300'
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
        segments: f.segment.map(x => ({
          airline: x.airline,
          flight: x.flightNo,
          aircraft: x.aircraft in aircraftCodes ? aircraftCodes[x.aircraft] : x.aircraft,
          fromCity: x.origin,
          toCity: x.destination,
          departure: x.departureDateTime,
          arrival: x.arrivalDateTime,
          duration: this.parseDuration(x.duration),
          nextConnection: this.parseDuration(x.nextConnection),
          cabin: cabinCodes[x.cabin],
          stops: parseInt(x.stop),
          lagDays: parseInt(x.lagDays),
          bookingCode: x.bookClass
        }))
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
}
