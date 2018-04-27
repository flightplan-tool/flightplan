const fs = require('fs')
const cheerio = require('cheerio')

const { truthy } = require('../../lib/utils')
const { isBlocked } = require('./helpers')

// Regex patterns
const reFlight = /FLIGHT\s+(\w+)\s/
const reAircraft = /Aircraft type:\s+\((.+)\)/

function parser (html, query) {
  const { fromCity, toCity, cabinClass, departDate, returnDate, adults, children } = query

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
  departures = parseTable($, tables[0], {fromCity, toCity, date: departDate, cabinClass})
  returns = (tables.length <= 1) ? []
    : parseTable($, tables[1], {fromCity: toCity, toCity: fromCity, date: returnDate, cabinClass})

  // Create final list of awards, and return it
  const awards = [...departures, ...returns]
  awards.forEach(x => { x.quantity = adults + children })

  return { awards }
}

function parseTable ($, table, query) {
  const { fromCity, toCity, cabinClass, date, adults, children } = query
  const awards = []
  const quantity = adults + children

  // Iterate over flights in this table
  $(table).find('td.flight-part').each((_, row) => {
    let flight = reFlight.exec($(row).find('span[id^=originFlight-]').text())
    let aircraft = reAircraft.exec($(row).find('div.details > p').text())
    flight = flight ? flight[1] : null
    aircraft = aircraft ? aircraft[1] : ''
    let fareCodes = [
      parseAward($, cabinClass, $(row).find('td.hidden-mb.package-1')),
      parseAward($, cabinClass, $(row).find('td.hidden-mb.package-2'))
    ]
    fareCodes = fareCodes.filter(x => x).join(' ')
    awards.push({ fromCity, toCity, date, cabinClass, flight, aircraft, fareCodes, quantity })
  })

  return awards
}

function parseAward ($, code, element) {
  // Check for radio button with data attributes
  const radio = $(element).find('input[type="radio"]')
  if (radio.length !== 0) {
    const waitlisted = truthy(radio.attr('data-waitlisted'))
    const flightClass = radio.attr('data-flight-class')[0].toUpperCase()
    return code + flightClass + (waitlisted ? '@' : '+')
  }
  if (element.text().includes('Not available')) {
    return ''
  }
  throw new Error('Could not parse award element:', element.text())
}

module.exports = parser
