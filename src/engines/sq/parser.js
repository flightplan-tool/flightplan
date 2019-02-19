const moment = require('moment-timezone')
const timetable = require('timetable-fns')

const Award = require('../../Award')
const Flight = require('../../Flight')
const Parser = require('../../Parser')
const Segment = require('../../Segment')
const { cabins } = require('../../consts')
const { aircraft } = require('../../data')
const utils = require('../../utils')

// Regex patterns
const reFlight = /FLIGHT\s+([A-Z0-9]{3,6})\b/
const reAircraft = /Aircraft type:\s+\((.+)\)/
const reHour = /(\w{3})\s+(\d{1,2}:\d{2})/
const reDate = /\d{1,2}\s+[A-Za-z]{3}/
const reMileage = /[\d,]+/

// Cabin codes
const cabinCodes = {
  [cabins.economy]: 'economy',
  [cabins.premium]: 'premium',
  [cabins.business]: 'business',
  [cabins.first]: 'suites'
}

module.exports = class extends Parser {
  parse (results) {
    return [
      ...this.parseResults(results.$('results'), false),
      ...this.parseResults(results.$('partners1'), true),
      ...this.parseResults(results.$('partners2'), true)
    ]
  }

  parseResults ($, partner) {
    if (!$) {
      return []
    }

    // Check if no available awards
    if ($('h2.main-heading').text().includes('Select alternative date')) {
      return []
    }
    const msg = $('div.alert__message').text().trim()
    if (
      msg.includes('no seats available') ||
      msg.includes('no flights available') ||
      msg.includes('constitutes a backtrack routing')
    ) {
      return []
    }

    // Scan for flights
    for (const cabin of Object.keys(cabins)) {
      const flights = this.parseFlights($, cabin, partner)
      if (flights) {
        return flights // Results page only has one cabin type
      }
    }

    // Failed to find any flights, should not happen
    throw new Parser.Error('Failed to parse flights from HTML')
  }

  parseFlights ($, cabin, partner) {
    const rows = $(`table.type-${cabinCodes[cabin]}-orb`)
    if (rows.length === 0) {
      return null
    }

    // Iterate over flights
    const flights = []
    rows.each((_, row) => {
      // Build up segments
      const segments = []
      const cabins = []
      let details = null
      let currentCabin = null
      let referenceDate = null
      $(row).find('.flights__info').each((_, x) => {
        // Check for flight number
        const header = $(x).find('div.flights--detail.left').first()
        if (header.length) {
          const airline = header.first().attr('data-carrier-code')
          const flight = reFlight.exec(header.first().find('span').text())[1]
          details = { airline, flight }
        }

        // Check for cabin
        const cabin = this.cabinDisplayed($, x)
        if (cabin) {
          currentCabin = cabin
        }

        // Check for aircraft
        const aircraftDetails = $(x).find('div.details > p')
        if (aircraftDetails.length) {
          const result = reAircraft.exec(aircraftDetails.first().text())
          if (result) {
            const aircraftName = result[1].replace(' Industrie', '')
            const aircraftInfo = aircraft.find(x => x.name === aircraftName)
            details.aircraft = aircraftInfo ? aircraftInfo.icao : aircraftName
          }
        }

        // Check for departure / arrival info
        const info = $(x).find('div.flights__info--detail')
        if (info.length) {
          // Parse departing info
          const {
            city: fromCity,
            time: departure,
            date: date1
          } = this.parseFlightDetails($, info.eq(0))

          // Parse arrival info
          const {
            city: toCity,
            time: arrival,
            date: date2
          } = this.parseFlightDetails($, info.eq(1))

          // Set reference date, and year
          if (!referenceDate) {
            referenceDate = (fromCity === this.query.fromCity)
              ? this.query.departDate
              : this.query.returnDate
          }
          const departDate = timetable.coerce(utils.closestYear(date1, referenceDate))
          const arrivalDate = timetable.coerce(utils.closestYear(date2, referenceDate))

          // Add segment
          segments.push(new Segment({
            ...details,
            fromCity,
            toCity,
            date: departDate,
            departure,
            arrival,
            lagDays: timetable.diff(departDate, arrivalDate)
          }))

          // Add the cabin for this segment
          cabins.push(currentCabin)
        }
      })

      // Parse award availability and pricing
      const saverAward = this.parseAward($,
        $(row).find('td.hidden-mb.package-1'),
        this.findFare(cabin, true), partner, cabins)
      const advantageAward = this.parseAward($,
        $(row).find('td.hidden-mb.package-2'),
        this.findFare(cabin, false), partner, cabins)
      const awards = [ saverAward, advantageAward ].filter(x => !!x)

      // Create a flight from the segments
      flights.push(new Flight(segments, awards))
    })

    return flights
  }

  cabinDisplayed ($, details) {
    const displayCodes = {
      'Economy': cabins.economy,
      'Premium Economy': cabins.premium,
      'Business': cabins.business,
      'First': cabins.first,
      'Suites': cabins.first
    }
    const ele = $(details).find('[id^=cabinForDisplay]')
    return ele.length ? displayCodes[ele.first().attr('value').trim()] : null
  }

  parseFlightDetails ($, details) {
    const hourResult = reHour.exec($(details).find('span.hour').text())
    const city = hourResult[1]
    const time = moment.utc(hourResult[2], 'H:mm', true)
    const dateResult = reDate.exec($(details).find('span.date').text())
    const date = moment.utc(dateResult[0], 'DD MMM', true)
    return { city, time, date }
  }

  parseAward ($, element, fare, partner, cabins) {
    const { results, query } = this
    const { engine } = results
    const { quantity } = query

    // Check for radio button with data attributes
    const radio = $(element).find('input[type="radio"]')
    if (radio.length !== 0) {
      // Calculate mileage per passenger
      const mileageText = $(element).find('.package--price-number').text()
      const mileageResult = reMileage.exec(mileageText)
      if (!mileageResult) {
        throw new Parser.Error('Could not parse award mileage:', mileageText)
      }
      const mileageCost = parseInt(mileageResult[0].replace(',', ''))

      // Calculate other award details
      const waitlisted = utils.truthy(radio.attr('data-waitlisted'))

      // Return the award
      return new Award({
        engine,
        partner,
        cabins,
        fare,
        quantity,
        waitlisted,
        mileageCost
      })
    }
    if (element.length === 0 || element.text().includes('Not available')) {
      return null
    }
    throw new Parser.Error('Could not parse award element:', element.text())
  }
}
