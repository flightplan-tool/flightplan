const { DateTime } = require('luxon')

const Award = require('../../Award')
const Flight = require('../../Flight')
const Parser = require('../../Parser')
const Segment = require('../../Segment')
const { cabins } = require('../../consts')
const utils = require('../../utils')

// Regex patterns
const reDate = /^\w{3}\s\d+/
const reTime = /\d{2}:\d{2}/
const reAircraft = /^[A-Z0-9]{3,4}\b/

module.exports = class extends Parser {
  parse (results) {
    this.airports = results.contents('json', 'airports').airports

    // Parse inbound and outbound flights
    const departures = this.parseFlights(results.$('outbound'), true)
    const arrivals = this.parseFlights(results.$('inbound'), false)
    return [...departures, ...arrivals]
  }

  parseFlights ($, isOutbound) {
    const { query } = this
    const { engine } = this.results
    const referenceDate = isOutbound ? query.departDateObject() : query.returnDateObject()

    const flights = []
    if ($) {
      $('tr.oneWayDisplayPlan').each((_, row) => {
        // Check which cabins have availability
        const availability = this.parseAvailability($, row)
        if (availability.size === 0) {
          return // No availability for this flight
        }

        // Create segments
        const segments = []
        let lastDate = referenceDate
        $(row).find('div.designTr').each((_, seg) => {
          // Check if the departure date of the segment is a different date
          const dateChange = $(seg).find('div.optionalRow.dateChange')
          if (dateChange.length) {
            lastDate = this.parseDate($(dateChange[0]).text().trim(), referenceDate)
          }

          // Parse the schedule
          const sections = $(seg).find('div.designTr')
          if (sections.length === 0) {
            return
          }
          const departure = this.parseTimeAndCity($, sections[0])
          const arrival = this.parseTimeAndCity($, sections[1])
          const flightInfo = this.parseFlightInfo($, sections[2])

          segments.push(new Segment({
            ...flightInfo,
            fromCity: departure.city,
            toCity: arrival.city,
            date: lastDate.toSQLDate(),
            departure: departure.time,
            arrival: arrival.time,
            lagDays: arrival.lagDays
          }))
        })
        if (segments.length === 0) {
          throw new Error('Unable to parse flight segments')
        }

        // Determine partner status
        const partner = this.isPartner(segments)

        // Create awards
        const awards = []
        for (const [cabin, status] of availability) {
          awards.push(new Award({
            engine,
            partner,
            cabins: Array(segments.length).fill(cabin),
            fare: this.findFare(cabin),
            quantity: query.quantity,
            exact: false,
            waitlisted: status === '@'
          }))
        }

        flights.push(new Flight(segments, awards))
      })
    }

    return flights
  }

  parseAvailability ($, row) {
    const map = new Map()
    const cols = $(row).find('td')
    const arrCabins = [cabins.economy, cabins.business, cabins.first]

    // Iterate over available cabins
    arrCabins.forEach((cabin, i) => {
      const text = $(cols.get(i)).text().trim().toLowerCase()
      const status = text.includes('available') ? '+' : (text.includes('waitlisted') ? '@' : '')
      if (status !== '') {
        map.set(cabin, status)
      }
    })

    return map
  }

  parseTimeAndCity ($, ele) {
    const fields = $(ele).find('div.designTd')
    if (fields.length !== 2) {
      throw new Error(`Invalid time / city structure: ${$(ele).html().trim()}`)
    }
    const strTime = $(fields[0]).text().trim()
    const strCity = $(fields[1]).text().trim()
    return {
      time: this.flightTime(strTime),
      lagDays: this.lagDays(strTime),
      city: this.airportCode(strCity)
    }
  }

  parseFlightInfo ($, ele) {
    const fields = $(ele).find('div.designTd')
    if (fields.length !== 2) {
      throw new Error(`Invalid flight info structure: ${$(ele).html().trim()}`)
    }
    const flight = $(fields[0]).text().trim()
    const strOther = $(fields[1]).text().trim()
    return {
      airline: flight.slice(0, 2),
      flight,
      aircraft: this.aircraft(strOther)
    }
  }

  airportCode (name) {
    const result = this.airports.find(x => x.name === name)
    if (!result) {
      throw new Error(`Unrecognized airport: ${name}`)
    }
    return result.codeSuggest
  }

  parseDate (str, referenceDate) {
    const result = reDate.exec(str)
    if (result) {
      const dt = DateTime.fromFormat(result[0], 'LLL d', { zone: 'utc' })
      if (dt.isValid) {
        // Fill in year from query
        return utils.setNearestYear(referenceDate, dt)
      }
    }
    throw new Error(`Failed to parse date: ${str}`)
  }

  flightTime (str) {
    const result = reTime.exec(str)
    if (!result) {
      throw new Error(`Failed to parse flight time: ${str}`)
    }
    return result[0]
  }

  lagDays (str) {
    const idx = str.indexOf('+')
    return (idx >= 0) ? parseInt(str.slice(idx + 1)) : 0
  }

  aircraft (str) {
    const result = reAircraft.exec(str)
    return result ? result[0] : null
  }
}
