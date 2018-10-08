const cheerio = require('cheerio')

const Parser = require('../base/parser')
const { cabins } = require('../consts')
const { aircraft } = require('../data')

// Regex patterns
const reCabin = /^(.+)\s+Class/
const reDate = /^\w{3}\s\d+/
const reTime = /\d{2}:\d{2}/
const reLagDays = /\+(\d)day/

class ParserError extends Error {
  constructor (message) {
    super(message)
    this.name = 'ParserError'
  }
}

module.exports = class extends Parser {
  parse (query, assets) {
    const $ = assets.html.find(x => x.name === 'results').$
    const json = assets.json.find(x => x.name === 'extra').contents
    this.airports = json.airports
    this.recommendationList = json.recommendationList

    try {
      // Parse inbound and outbound flights
      const departures = this.parseFlights($, json.outboundFlightInfoList, 'div.selectItineraryOutbound', true)
      const arrivals = this.parseFlights($, json.inboundFlightInfoList, 'div.selectItineraryInbound', false)
      return { awards: [...departures, ...arrivals] }
    } catch (err) {
      // Handle parsing errors (or re-throw, if not a parsing error)
      if (err instanceof ParserError) {
        return { error: err.message }
      }
      throw err
    }
  }

  parseFlights ($, json, sel, isOutbound) {
    // Extract flights from JSON first
    const map = new Map()
    json.forEach(x => {
      // De-dupe based on flightId
      const { flightId } = x[0]
      map.set(flightId, { flightId, segments: x })
    })

    // Check if there are any flights
    if (map.size === 0) {
      return []
    }

    // Get the flights table
    const table = $(sel).first()
    if (table.length === 0) {
      throw new ParserError(`Flight table missing: ${sel}`)
    }

    // Map data from the HTML table back to the JSON
    const awards = []
    for (const [flightId, flight] of map) {
      const sel = $(table).find(`.selectItineraryCheck i[data-value="${flightId}"]`)
      if (sel.length === 0) {
        throw new ParserError(`Missing HTML entry corresponding to flightId: ${flightId}`)
      }
      const result = sel.parentsUntil('.itinModeAvailabilityResult').last()
      if (result.length === 0) {
        throw new ParserError(`Non-standard parent structure for HTML flight entries`)
      }

      // Get details for each segment
      const detailsMap = new Map()
      $(result).find('div.detailWrap').each((_, wrap) => {
        const details = $(wrap).find('div.detailInformation span')
        const flightNumber = details.first().text().trim()
        detailsMap.set(flightNumber, details)
      })

      // Fill out segment information
      const segments = []
      let flightDate = null
      for (const segment of flight.segments) {
        const { flightNumber, depDate, depAirport, arrAirport, depTime, arrTime } = segment

        // If depDate is missing, use the value from the previous segment (it will be same)
        if (depDate && depDate !== '') {
          flightDate = depDate
        }

        // Get details from HTML
        const details = detailsMap.get(flightNumber)
        if (!details) {
          throw new ParserError(`Missing segment details in HTML for flight: ${flightNumber}`)
        }

        segments.push({
          airline: flightNumber.substring(0, 2),
          flight: flightNumber,
          aircraft: this.aircraft($, details),
          fromCity: this.airportCode(depAirport),
          toCity: this.airportCode(arrAirport),
          date: this.departureDate(flightDate),
          departure: this.flightTime(depTime),
          arrival: this.flightTime(arrTime),
          cabin: this.cabin($, details),
          lagDays: this.lagDays(arrTime)
        })
      }

      // Calculate award fare code and mileage
      const award = { segments }
      award.cabin = this.bestCabin(award.segments)
      award.mileage = this.mileage(flightId, isOutbound)
      award.quantity = this.quantity(flightId, isOutbound)
      award.fares = this.fares(award.cabin, true, award.quantity > 0)
      awards.push(award)
    }

    return awards
  }

  aircraft ($, details) {
    const iata = $(details).not('.starAlliance').eq(1).text().trim()
    const result = aircraft.find(x => x.iata === iata)
    return result ? result.icao : iata
  }

  airportCode (name) {
    const result = this.airports.find(x => x.name === name)
    if (!result) {
      throw new ParserError(`Unrecognized airport: ${name}`)
    }
    return result.code
  }

  departureDate (str) {
    const result = reDate.exec(cheerio.load(str).text()) // Strip HTML tags
    if (!result) {
      throw new ParserError(`Failed to parse departure date: ${str}`)
    }

    // Start with base departure date, from query
    return this.parseDate(result[0], 'LLL d').toSQLDate()
  }

  flightTime (str) {
    const result = reTime.exec(str)
    if (!result) {
      throw new ParserError(`Failed to parse flight time: ${str}`)
    }
    return result[0]
  }

  lagDays (str) {
    const result = reLagDays.exec(str)
    return result ? parseInt(result[1]) : 0
  }

  cabin ($, details) {
    const displayCodes = {
      'Economy': cabins.economy,
      'Business': cabins.business,
      'First': cabins.first
    }
    const cabin = reCabin.exec(details.last().text().trim())
    return displayCodes[cabin[1]]
  }

  offers (flightId, isOutbound) {
    flightId = parseInt(flightId)
    return this.recommendationList.filter(x =>
      (isOutbound ? x.outBoundFlightId : x.inBoundFlightId) === flightId)
  }

  mileage (flightId, isOutbound) {
    const arr = this.offers(flightId, isOutbound)
      .map(x => x.milesCost).filter(x => x > 0)
    return (arr.length === 0) ? 0 : (Math.min(...arr) / 2)
  }

  quantity (flightId, isOutbound) {
    const arr = this.offers(flightId, isOutbound)
      .map(x => isOutbound ? x.outBoundSeats : x.inBoundSeats)
    return (arr.length === 0) ? 0 : Math.max(...arr)
  }
}
