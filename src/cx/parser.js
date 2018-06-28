const Parser = require('../base/parser')
const { cabins } = require('../consts')

// Regex patterns
const reFlight = /CX\d+/
const rePrice = /\d+,000/

module.exports = class extends Parser {
  parse (request, $, html) {
    const { fromCity, toCity, cabin, departDate } = request
    const fareMap = buildFareMap(this.config.fares)

    // Check if no available awards
    if ($('.no-flights-header').length > 0) {
      return { awards: [] }
    }

    // Confirm cabin and fare class
    let active = $('.cabin-ticket-card-wrapper-outer.active')
    if (active.length === 0) {
      return { error: 'Active fare class not found' }
    }
    active = [
      $(active).find('span.cabin-class'),
      $(active).find('span.ticket-type')
    ].map(x => x.text().trim()).join(' ')
    const fare = fareMap.get(active)
    if (!fare || fare.cabin !== cabin) {
      return { error: 'Wrong cabin detected' }
    }

    // Get list of flights
    const awards = []
    const table = $('.col-select-flight-wrap')
    $(table).find('.row-flight-card').each((_, row) => {
      // Check if flight is not available
      if ($(row).hasClass('inactive') || $(row).hasClass('flight-full')) {
        return
      }

      // Get flight number
      const segments = $(row).find('span.flight-number')
      if (segments.length !== 1) {
        return // Only interested in non-stop flights
      }
      let flight = reFlight.exec(segments.text())
      if (!flight) {
        return // Only interested in CX flights
      }
      flight = flight[0]

      // TODO: Need to fetch flight details at search time, to get aircraft
      const aircraft = 'Unknown'

      // Ensure the flight is available (should have a valid price)
      const price = rePrice.exec($(row).find('span.am-total').text())
      if (!price) {
        return
      }

      // Check if it's waitlist
      const waitlisted = $(row).find('.row-flight-pricing-seat').text().includes('Waitlist')

      // Get fare code
      const fares = fare.code + (waitlisted ? '@' : '+')

      // Add the award
      awards.push({ fromCity, toCity, date: departDate, cabin, flight, aircraft, fares })
    })

    // Create final list of awards, and return it
    return { awards }
  }
}

function buildFareMap (fares) {
  const cabinStr = {
    [cabins.economy]: 'Economy',
    [cabins.premium]: 'Premium Economy',
    [cabins.business]: 'Business',
    [cabins.first]: 'First'
  }
  const typeStr = {
    'S': 'Standard',
    '1': 'Choice',
    '2': 'Tailored'
  }
  const map = new Map()
  for (const fare of fares) {
    map.set(`${cabinStr[fare.cabin]} ${typeStr[fare.code[1]]}`, fare)
  }
  return map
}
