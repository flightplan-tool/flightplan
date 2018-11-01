const cheerio = require('cheerio')
const { DateTime } = require('luxon')

const Award = require('../../Award')
const Flight = require('../../Flight')
const Parser = require('../../Parser')
const Segment = require('../../Segment')
const { cabins } = require('../../consts')
const { aircraft } = require('../../data')

// Regex patterns
const reCabin = /^(.+)\s+Class/
const reDate = /^\w{3}\s\d+/
const reTime = /\d{2}:\d{2}/
const reLagDays = /\+(\d)day/

module.exports = class extends Parser {
  parse (results) {
    const $ = results.$('results')
    const json = results.contents('json', 'extra')
    this.airports = json.airports
    this.recommendationList = json.recommendationList

    // Parse inbound and outbound flights
    const departures = this.parseFlights($, json.outboundFlightInfoList, 'div.selectItineraryOutbound', true)
    const arrivals = this.parseFlights($, json.inboundFlightInfoList, 'div.selectItineraryInbound', false)
    return [...departures, ...arrivals]
  }

  parseFlights ($, json, sel, isOutbound) {
    const { query } = this

    // Extract flights from JSON first
    const map = new Map()
    json.forEach(x => {
      // De-dupe based on flightId
      const { flightId } = x[0]
      map.set(flightId, x)
    })

    // Check if there are any flights
    if (map.size === 0) {
      return []
    }

    // Get the flights table
    const table = $(sel).first()
    if (table.length === 0) {
      throw new Parser.Error(`Flight table missing: ${sel}`)
    }

    // Map data from the HTML table back to the JSON
    const awards = []
    for (const [flightId, segments] of map) {
      const flight = this.createFlight($, table, flightId, segments)

      // Calculate award fare code and mileage
      const quantity = this.quantity(flightId, isOutbound)
      awards.push(new Award({
        engine: this.results.engine,
        fare: this.findFare(flight.highestCabin()),
        quantity: (quantity > 0) ? quantity : query.quantity,
        waitlisted: quantity > 0,
        mileageCost: this.mileage(flightId, isOutbound)
      }, flight))
    }

    return awards
  }

  createFlight ($, table, flightId, list) {
    const sel = $(table).find(`.selectItineraryCheck i[data-value="${flightId}"]`)
    if (sel.length === 0) {
      throw new Parser.Error(`Missing HTML entry corresponding to flightId: ${flightId}`)
    }
    const result = sel.parentsUntil('.itinModeAvailabilityResult').last()
    if (result.length === 0) {
      throw new Parser.Error(`Non-standard parent structure for HTML flight entries`)
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
    for (const segment of list) {
      const { flightNumber, depDate, depAirport, arrAirport, depTime, arrTime } = segment

      // If depDate is missing, use the value from the previous segment (it will be same)
      if (depDate && depDate !== '') {
        flightDate = depDate
      }

      // Get details from HTML
      const details = detailsMap.get(flightNumber)
      if (!details) {
        throw new Parser.Error(`Missing segment details in HTML for flight: ${flightNumber}`)
      }

      segments.push(new Segment({
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
      }))
    }
    return new Flight(segments)
  }

  aircraft ($, details) {
    const iata = $(details).not('.starAlliance').eq(1).text().trim()
    const result = aircraft.find(x => x.iata === iata)
    return result ? result.icao : iata
  }

  airportCode (name) {
    const result = this.airports.find(x => x.name === name)
    if (!result) {
      throw new Parser.Error(`Unrecognized airport: ${name}`)
    }
    return result.codeSuggest
  }

  departureDate (str) {
    const result = reDate.exec(cheerio.load(str).text()) // Strip HTML tags
    if (!result) {
      throw new Parser.Error(`Failed to parse departure date: ${str}`)
    }

    // Start with base departure date, from query
    return DateTime.fromFormat(result[0], 'LLL d', { zone: 'utc' }).toSQLDate()
  }

  flightTime (str) {
    const result = reTime.exec(str)
    if (!result) {
      throw new Parser.Error(`Failed to parse flight time: ${str}`)
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
