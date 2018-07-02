const Parser = require('../base/parser')
const { cabins } = require('../consts')

// Regex patterns
const reFlight = /([A-Z]+)\d+/
const rePrice = /\d+,000/

// Cached mapping of flight => aircraft
const aircraftForFlight = {
  'CX851': 'Airbus A350-900',
  'CX870': 'Boeing 777-300',
  'CX872': 'Boeing 777-300ER',
  'CX873': 'Boeing 777-300ER',
  'CX879': 'Boeing 777-300ER',
  'CX892': 'Airbus A350-900',
  'CX893': 'Airbus A350-900',
  'CX895': 'Airbus A350-900',
  'CX2873': 'Boeing 777-300ER',
  'CX2892': 'Airbus A350-900',
  'CX2893': 'Airbus A350-900',
  'CX5660': 'Airbus A330-300',
  'CX5662': 'Airbus A330-300',
  'CX5668': 'Airbus A330-300',
  'KA660': 'Airbus A330-300',
  'KA661': 'Airbus A330-300',
  'KA662': 'Airbus A330-300',
  'KA663': 'Airbus A330-300',
  'KA668': 'Airbus A330-300'
}

module.exports = class extends Parser {
  parse (request, $, html) {
    const { fromCity, toCity, cabin, departDate } = request
    const fareMap = buildFareMap(this.config.fares)

    // Check if no available awards
    if ($('.no-flights-header').length > 0 ||
      $('span.label-error').text().includes('no flights available')) {
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
    let error = null
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
        error = `Failed to parse valid flight number: ${segments.text()}`
        return
      }
      if (flight[1] !== 'CX' && flight[1] !== 'KA') {
        return // Only interested in CX flights
      }
      flight = flight[0]

      // Double-check the origin / destination
      error = checkCities($, row, 'div.flight-origin', 'div.flight-destination', request)
      if (error) {
        return
      }

      // TODO: Need to fetch flight details at search time, to get aircraft
      const aircraft = aircraftForFlight[flight] || '(Unknown Aircraft)'

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

    // Check for any errors
    if (error) {
      return { error }
    }

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

function checkCities ($, row, selOrigin, selDestination, request) {
  const { fromCity, toCity } = request
  const origin = $(row).find(selOrigin).text().trim()
  const destination = $(row).find(selDestination).text().trim()
  if (origin !== fromCity) {
    return `Incorrect origin city detected: ${origin} (expected: ${fromCity})`
  }
  if (destination !== toCity) {
    return `Incorrect destination city detected: ${destination} (expected: ${toCity})`
  }
  return null
}
