const { DateTime } = require('luxon')

const Parser = require('../base/parser')
const { cabins } = require('../consts')
const { aircraft } = require('../data')
const utils = require('../../shared/utils')

// Regex patterns
const reAircraft = /Aircraft type:\s+\((.+)\)/
const reHour = /(\w{3})\s+(\d{1,2}:\d{2})/
const reDate = /\d{1,2}\s+\w{3}/
const reMileage = /[,\d]+/

module.exports = class extends Parser {
  parse (query, assets) {
    const awards = this.parseResults(assets, 'results')
    if (query.partners) {
      const partnerAwards = [
        ...this.parseResults(assets, 'partners1'),
        ...this.parseResults(assets, 'partners2')
      ]
      partnerAwards.forEach(x => { x.partner = true })
      awards.push(...partnerAwards)
    }
    return { awards }
  }

  parseResults (assets, id) {
    const asset = assets.html.find(x => x.name === id)
    if (!asset) {
      return []
    }
    const $ = asset.$

    // Check if no available awards
    if ($('h2.main-heading').text().includes('Select alternative date') ||
      $('div.alert__message').text().includes('There are no seats available')) {
      return []
    }

    // Find the awards table
    const tables = $('#redemptionChooseFlightsForm > fieldset > div.flights__searchs')
    if (tables.length === 0) {
      return { error: 'Award table not found' }
    }

    // Parse both departure and return awards
    const departures = this.parseTable($, tables[0])
    const returns = (tables.length <= 1) ? []
      : this.parseTable($, tables[1])

    // Create final list of awards, and return it
    return [...departures, ...returns]
  }

  parseTable ($, table) {
    const awards = []

    // Iterate over flights
    $('td.flight-part').each((_, row) => {
      // Build up segments
      const segments = []
      let details = null
      $(row).find('.flights__info').each((_, x) => {
        // Check for flight number
        const header = $(x).find('div.flights--detail.left').first()
        if (header.length) {
          const airline = header.first().attr('data-carrier-code')
          const flightNumber = header.first().attr('data-flight-number')
          const flight = airline + parseInt(flightNumber).toString()
          details = { airline, flight }
        }

        // Check for cabin
        const cabin = this.cabinDisplayed($, x)
        if (cabin) {
          details.cabin = cabin
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
            date
          } = this.parseFlightDetails($, info.eq(0))

          // Parse arrival info
          const {
            city: toCity,
            time: arrival,
            date: arrivalDate
          } = this.parseFlightDetails($, info.eq(1))

          // Add segment
          segments.push({
            ...details,
            fromCity,
            toCity,
            date: date.toSQLDate(),
            departure,
            arrival,
            lagDays: this.computeLagDays(date, arrivalDate)
          })
        }
      })

      // Parse award availability and pricing
      const saverAward = this.parseAward($, $(row).find('td.hidden-mb.package-1'), true, segments)
      const advantageAward = this.parseAward($, $(row).find('td.hidden-mb.package-2'), false, segments)
      awards.push(...[ saverAward, advantageAward ].filter(x => !!x))
    })

    return awards
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
    const time = hourResult[2]
    const dateResult = reDate.exec($(details).find('span.date').text())
    const date = this.parseDate(dateResult[0], 'dd MMM')
    return { city, time, date }
  }

  parseAward ($, element, saver, segments) {
    // Check for radio button with data attributes
    const radio = $(element).find('input[type="radio"]')
    if (radio.length !== 0) {
      // Calculate mileage per passenger
      const mileageText = $(element).find('.package--price-number').text()
      const mileageResult = reMileage.exec(mileageText)
      if (!mileageResult) {
        throw new Error('Could not parse award mileage:', mileageText)
      }
      const mileage = parseInt(mileageResult[0].replace(',', '')) / Math.max(this.query.quantity, 1)

      // Calculate other award details
      const waitlisted = utils.truthy(radio.attr('data-waitlisted'))
      const cabin = this.bestCabin(segments)
      const fares = this.fares(cabin, saver, waitlisted)

      // Return the award
      return { cabin, mileage, fares, segments }
    }
    if (element.length === 0 || element.text().includes('Not available')) {
      return null
    }
    throw new Error('Could not parse award element:', element.text())
  }
}
