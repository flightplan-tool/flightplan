const Parser = require('../base/Parser')
const { cabins } = require('../consts')
const utils = require('../../shared/utils')

// Regex patterns
const reFlight = /FLIGHT\s+(\w+)\s/
const reAircraft = /Aircraft type:\s+\((.+)\)/

module.exports = class extends Parser {
  parse (request, $, html) {
    const { fromCity, toCity, cabin, departDate, returnDate } = request

    // Find the awards table
    const tables = $('#redemptionChooseFlightsForm > fieldset > div.flights__searchs')
    if (tables.length === 0) {
      return { error: 'Award table not found' }
    }

    // Select the fares relevant to this request
    const codes = {}
    for (const fare of this.config.fares) {
      if (fare.cabin === cabin) {
        codes[fare.code] = fare
      }
    }

    // Request parameters for each direction
    const departRequest = {fromCity, toCity, date: departDate, cabin}
    const returnRequest = {fromCity: toCity, toCity: fromCity, date: returnDate, cabin}

    // Parse both departure and return awards
    const departures = parseTable($, tables[0], departRequest, codes)
    const returns = (tables.length <= 1) ? []
      : parseTable($, tables[1], returnRequest, codes)

    // Create final list of awards, and return it
    return { awards: [...departures, ...returns] }
  }
}

function parseTable ($, table, request, codes) {
  const { fromCity, toCity, cabin, date } = request
  const awards = []

  // Iterate over flights in this table
  $(table).find('td.flight-part').each((_, row) => {
    // Confirm the cabin being displayed matches what we searched for
    if (cabinDisplayed($, row) === cabin) {
      let flight = reFlight.exec($(row).find('span[id^=originFlight-]').text())
      let aircraft = reAircraft.exec($(row).find('div.details > p').text())
      flight = flight ? flight[1] : null
      aircraft = aircraft ? aircraft[1] : ''
      let fares = [
        parseAward($, codes, $(row).find('td.hidden-mb.package-1')),
        parseAward($, codes, $(row).find('td.hidden-mb.package-2'))
      ]
      fares = fares.filter(x => x).join(' ')
      awards.push({ fromCity, toCity, date, cabin, flight, aircraft, fares })
    }
  })

  return awards
}

function cabinDisplayed ($, row) {
  const displayCodes = {
    'Economy': cabins.economy,
    'Premium Economy': cabins.premium,
    'Business': cabins.business,
    'First': cabins.first,
    'Suites': cabins.first
  }
  return displayCodes[$(row).find('#cabinForDisplay0').attr('value').trim()]
}

function parseAward ($, codes, element) {
  // Check for radio button with data attributes
  const radio = $(element).find('input[type="radio"]')
  if (radio.length !== 0) {
    const waitlisted = utils.truthy(radio.attr('data-waitlisted'))
    const flightClass = radio.attr('data-flight-class')[0].toUpperCase()
    const code = Object.keys(codes).find(x => (codes[x].saver === (flightClass === 'S')))
    return code + (waitlisted ? '@' : '+')
  }
  if (element.text().includes('Not available')) {
    return ''
  }
  throw new Error('Could not parse award element:', element.text())
}
