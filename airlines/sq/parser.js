const cheerio = require('cheerio')

const SQEngine = require('./engine')
const { truthy } = require('../../lib/utils')
const { isBlocked } = require('./helpers')

// Regex patterns
const reFlight = /FLIGHT\s+(\w+)\s/
const reAircraft = /Aircraft type:\s+\((.+)\)/

function parser (html, query) {
  const { fromCity, toCity, cabin, departDate, returnDate, quantity } = query

  // Check if it was blocked
  if (isBlocked(html)) {
    return { error: 'Search was blocked' }
  }

  // Load html into parser
  const $ = cheerio.load(html)

  // Find the awards table
  const tables = $('#redemptionChooseFlightsForm > fieldset > div.flights__searchs')
  if (tables.length === 0) {
    return { error: 'Award table not found' }
  }

  // Parse both departure and return awards
  const departures = parseTable($, tables[0], {fromCity, toCity, date: departDate, cabin})
  const returns = (tables.length <= 1) ? []
    : parseTable($, tables[1], {fromCity: toCity, toCity: fromCity, date: returnDate, cabin})

  // Create final list of awards, and return it
  const awards = [...departures, ...returns]
  awards.forEach(x => {
    x.quantity = quantity
    x.airline = 'SQ'
  })

  return { awards }
}

function parseTable ($, table, query) {
  const { fromCity, toCity, cabin, date, quantity } = query
  const awards = []

  // Select the fares relevant to this query
  const codes = {}
  for (const [code, info] of Object.entries(SQEngine.config.fares)) {
    if (info.cabin === cabin) {
      codes[code] = info
    }
  }

  // Iterate over flights in this table
  $(table).find('td.flight-part').each((_, row) => {
    let flight = reFlight.exec($(row).find('span[id^=originFlight-]').text())
    let aircraft = reAircraft.exec($(row).find('div.details > p').text())
    flight = flight ? flight[1] : null
    aircraft = aircraft ? aircraft[1] : ''
    let fares = [
      parseAward($, codes, $(row).find('td.hidden-mb.package-1')),
      parseAward($, codes, $(row).find('td.hidden-mb.package-2'))
    ]
    fares = fares.filter(x => x).join(' ')
    awards.push({ fromCity, toCity, date, cabin, flight, aircraft, fares, quantity })
  })

  return awards
}

function parseAward ($, codes, element) {
  // Check for radio button with data attributes
  const radio = $(element).find('input[type="radio"]')
  if (radio.length !== 0) {
    const waitlisted = truthy(radio.attr('data-waitlisted'))
    const flightClass = radio.attr('data-flight-class')[0].toUpperCase()
    const code = Object.keys(codes).find(x => (codes[x].saver === (flightClass === 'S')))
    return code + (waitlisted ? '@' : '+')
  }
  if (element.text().includes('Not available')) {
    return ''
  }
  throw new Error('Could not parse award element:', element.text())
}

module.exports = parser
