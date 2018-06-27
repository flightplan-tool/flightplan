const moment = require('moment')

const Parser = require('../base/parser')

// Regex patterns
const rePrice = /[\d,]+ Miles/
const reSeats = /(\d+)\s+Seats\s+\(([A-Z]+)\)/

// Normalized aircraft names
const aircraftNormalizations = {
  'B747': 'Boeing 777',
  'B777': 'Boeing 777',
  'B787': 'Boeing 777'
}

module.exports = class extends Parser {
  parse (request, $, html) {
    const { fromCity, toCity, cabin, departDate, returnDate } = request

    // Check if no available awards
    if ($('div.alert-message').text().includes('Seats are unavailable on the date')) {
      return { awards: [] }
    }

    // Request parameters for each direction
    const departRequest = {fromCity, toCity, date: departDate, cabin}
    const returnRequest = {fromCity: toCity, toCity: fromCity, date: returnDate, cabin}

    // Find outbound and inbound tables
    let outbound = $('div.outbound')
    outbound = (outbound.length === 1) ? outbound[0] : undefined
    let inbound = $('div.inbound')
    inbound = (inbound.length === 1) ? inbound[0] : undefined
    if (!outbound || (returnDate && !inbound)) {
      return { error: 'Award table not found' }
    }

    // Parse both departure and return awards
    const departures = parseTable($, outbound, departRequest, this.config)
    const returns = returnDate ? parseTable($, inbound, returnRequest, this.config) : []

    // Create final list of awards, and return it
    return { awards: [...departures, ...returns] }
  }
}

function parseTable ($, table, request, config) {
  const { fromCity, toCity, cabin, date } = request
  const awards = []

  // Confirm date matches
  const tabDate = $(table).find('li.selected-date a').data('name')
  if (moment(date).format('MM/DD') !== tabDate) {
    return []
  }

  // Iterate over flights in this table
  $(table).find('div.flightItem').each((_, row) => {
    // Ensure the flight is available (should have a valid price)
    const price = rePrice.exec($(row).find('div.flight-fare-passenger-type').text())
    if (!price) {
      return
    }

    // Get quantity and fare code
    const seats = reSeats.exec($(row).find('span.avail-seats').text())
    if (!seats) {
      return
    }
    const quantity = seats[1]
    const fareCode = seats[2]
    const fares = fareCode + '+'

    // Confirm the cabin being displayed matches what we searched for
    const fare = config.fares.find(x => x.code === fareCode)
    if (!fare || fare.cabin !== cabin) {
      return
    }

    // Get flight number
    const flight = $(row).find('li.flight').data('flight-number')

    // Get aircraft
    const aircraft = normalizeAircraft($(row).find('span.airplane a').contents()[0].nodeValue)

    // Add the award
    awards.push({ fromCity, toCity, date, cabin, flight, aircraft, fares, quantity })
  })

  return awards
}

function normalizeAircraft (str) {
  for (const x in aircraftNormalizations) {
    str = str.replace(x, aircraftNormalizations[x])
  }
  return str
}
