const Parser = require('../base/Parser')
const { cabins } = require('../consts')

// Regex patterns
const reCabin = /^(.+)\s+Class/

module.exports = class extends Parser {
  parse (request, $, html) {
    const { fromCity, toCity, cabin, departDate, returnDate } = request

    // Request parameters for each direction
    const departRequest = {fromCity, toCity, date: departDate, cabin}
    const returnRequest = {fromCity: toCity, toCity: fromCity, date: returnDate, cabin}

    // Find outbound and inbound tables
    let outbound = $('div.selectItineraryOutbound')
    outbound = (outbound.length === 1) ? outbound[0] : undefined
    let inbound = $('div.selectItineraryInbound')
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

  // Iterate over flights in this table
  $(table).find('div.itinModeAvailabilityResult').each((_, row) => {
    // Ensure the flight is not deactivated
    if ($(row).hasClass('deactive')) {
      return
    }

    // Get flight details
    const details = $(row).find('div.flightDetail span')
    const flight = details.first().text().trim()
    const aircraft = $(details).find('a').first().prop('aria-label')
    const waitlisted = $(row).find('p.flagWait').length !== 0

    // Confirm cabin is what we searched for
    if (cabin !== cabinDisplayed($, details)) {
      return
    }

    // Calculate fare codes
    const fare = config.fares.find(x => x.cabin === cabin)
    const fares = fare.code + (waitlisted ? '@' : '+')

    // Add the award
    awards.push({ fromCity, toCity, date, cabin, flight, aircraft, fares })
  })

  return awards
}

function cabinDisplayed ($, details) {
  const displayCodes = {
    'Economy': cabins.economy,
    'Business': cabins.business,
    'First': cabins.first
  }
  const cabin = reCabin.exec(details.last().text().trim())
  return displayCodes[cabin[1]]
}
