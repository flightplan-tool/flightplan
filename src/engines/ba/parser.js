const moment = require('moment-timezone')

const Award = require('../../Award')
const Flight = require('../../Flight')
const Parser = require('../../Parser')
const Segment = require('../../Segment')
const { cabins } = require('../../consts')
const utils = require('../../utils')

// Regex patterns
const reQuantity = /(\d+)\s+left/i

module.exports = class extends Parser {
  parse (results) {
    const $ = results.$('results')

    // Parse direct flights first
    const direct = this.parseFlights($, '.direct-flight-details')
    const connecting = this.parseFlights($, '.connecting-flights')

    return [...direct, ...connecting]
  }

  parseFlights ($, sel) {
    const { engine, query } = this.results

    // Iterate over flights
    const awards = []
    $(sel).each((_, row) => {
      let originCity = null
      let outbound = null

      // Iterate over each segment
      const segments = []
      $(row).find('.travel-time-detail').each((_, x) => {
        // Get cities, and direction
        const airports = $(x).find('p.airport-code')
        const fromCity = airports.eq(0).text().trim()
        const toCity = airports.eq(1).text().trim()
        if (!originCity) {
          originCity = fromCity
          outbound = (originCity === query.fromCity)
        }

        // Get departure / arrival dates
        const strDepartDate = $(x).find('p.departdate').first().text().trim()
        const strArrivalDate = $(x).find('p.arrivaldate').first().text().trim()
        const departDate = this.parseDate(strDepartDate, query, outbound)
        const arrivalDate = this.parseDate(strArrivalDate, query, outbound)

        // Get departure / arrival times
        const departTime = $(x).find('p.departtime').first().text().trim()
        const arrivalTime = $(x).find('p.arrivaltime').first().text().trim()

        // Add segment
        const flightInfo = $(x).find('p.career-and-flight').first().text().split('-')
        const flightNumber = flightInfo[flightInfo.length - 1].trim()
        segments.push(new Segment({
          airline: flightNumber.substring(0, 2),
          flight: flightNumber,
          fromCity,
          toCity,
          date: departDate,
          departure: departTime,
          arrival: arrivalTime,
          lagDays: utils.daysBetween(departDate, arrivalDate)
        }))
      })

      // Get cabins / quantity for award
      $(row).find('div[class^="flightCabin"]').each((_, x) => {
        if ($(x).find('label.txtAvlSlctCls').length) {
          const flight = new Flight(segments)
          const seatsLeft = $(x).find('.message-number-of-seats')
          const quantity = this.parseQuantity(seatsLeft) || Math.max(query.quantity, 7)
          const cabin = this.parseCabin($(x).find('.travel-class'))
          const fare = this.findFare(cabin)
          const cabins = flight.segments.map(x => cabin)
          awards.push(new Award({ engine, fare, cabins, quantity }, flight))
        }
      })
    })

    return awards
  }

  parseDate (str, query, outbound) {
    let m = moment.utc(str, 'D MMM', true)
    
    // if the moment is invalid and the date string is '29 Feb', then assume that
    // the leap year is for the next year and re-initialize the moment
    if(!m.isValid() && str === '29 Feb') {
      m = moment.utc(`${str} ${new Date().getFullYear() + 1}`, 'D MMM YYYY', true)
    }
    
    if (m.isValid()) {
      return outbound
        ? query.closestDeparture(m)
        : query.closestReturn(m)
    } 
    return null
  }


  parseQuantity (ele) {
    if (ele) {
      const str = ele.text().trim()
      const result = reQuantity.exec(str)
      if (result) {
        return parseInt(result[1])
      }
    }
    return null
  }

  parseCabin (ele) {
    const displayCodes = {
      'Economy': cabins.economy,
      'Premium Economy': cabins.premium,
      'Business Class': cabins.business,
      'First': cabins.first
    }
    return displayCodes[ele.text().trim()]
  }
}
