const moment = require('moment-timezone')

const Award = require('../../Award')
const Flight = require('../../Flight')
const Parser = require('../../Parser')
const Segment = require('../../Segment')
const {
  cabins
} = require('../../consts')
const utils = require('../../utils')

// Regex patterns
const reQuantity = /only\s(\d+)\s+left\sat/i

module.exports = class extends Parser {
  parse(results) {
    const $ = results.$('results')

    // Parse direct flights first
    const direct = this.parseFlights($, 'tr[stops="0"]')
    const connecting = this.parseFlights($, 'tr:not([stops="0"])')

    return [...direct, ...connecting]
  }

  parseFlights($, sel) {
    const {
      engine,
      query
    } = this.results

    // Iterate over flights
    const awards = []
    $(sel).each((_, row) => {
      let originCity = null
      let outbound = null

      // Iterate over each segment
      const segments = []
      $(row).find('div.SegmentContainer').each((_, x) => {
        // Get cities, and direction
        const airports = $(x).find('.DetailsStation')
        const fromCity = airports.first().text().trim().match(/\((\S*)\)/)[1];
        const toCity = airports.last().text().trim().match(/\((\S*)\)/)[1];
        if (!originCity) {
          originCity = fromCity
          outbound = (originCity === query.fromCity)
        }

        // Get departure / arrival dates
        const strDepartDateTime = $(x).find('.DetailsTime').first().text().replace(/\r?\n|\r|\t/g, '')
        const strArrivalDateTime = $(x).find('.DetailsTime').last().text().replace(/\r?\n|\r|\t/g, '')
        const departDate = this.parseDate(strDepartDateTime, query, outbound)
        const arrivalDate = this.parseDate(strArrivalDateTime, query, outbound)

        // Get departure / arrival times
        const departTime = this.parseTime(strDepartDateTime)
        const arrivalTime = this.parseTime(strArrivalDateTime)

        // Add segment
        const airlineImgUrl = $(x).find('.DetailsCarrierImage').first().attr('src').split('/')
        const airline = airlineImgUrl[airlineImgUrl.length - 1].split('.')[0]
        const flightNumberArr = $(x).find('.DetailsFlightNumber').first().text().trim().split(' ')
        const flightNumber = flightNumberArr[flightNumberArr.length - 1]
        const aircraft = $(x).find('.DetailsSmall li:first-child').first().text().trim().replace('Aircraft: ', '')
        segments.push(new Segment({
          aircraft: aircraft,
          airline: airline,
          flight: `${airline}${flightNumber}`,
          fromCity,
          toCity,
          date: departDate,
          departure: departTime,
          arrival: arrivalTime,
          lagDays: utils.daysBetween(departDate, arrivalDate)
        }))
      })

      // Get cabins / quantity for award
      $(row).find('.lowest-fare.has-price').each((_, x) => {
        const flight = new Flight(segments)
        const seatsLeft = $(x).find('.SeatsRemainingDiv')
        const quantity = this.parseQuantity(seatsLeft) || Math.max(query.quantity, 7)
        const fare = this.findFare(this.parseCabinFromAward(x))
        const cabins = flight.segments.map((_, i) => this.parseCabinFromSegment($, x, i) || fare.cabin)
        const mileageCost = this.parseMileageCost($(x))
        const fees = this.parseFees($(x))

        awards.push(new Award({
          engine,
          fare,
          cabins,
          quantity,
          mileageCost,
          fees
        }, flight))
      })
    })

    return awards
  }

  parseDate(str, query, outbound) {
    const regexMathces = str.match(/([0-9]{1,2}:[0-9]{1,2})\s*([AaMmPpMm]{2}),\s*(\S{3}),\s*(\S{3})\s*([0-9]{1,2})/)
    const month = regexMathces[4]
    const date = regexMathces[5]
    const dateStr = `${date} ${month}`

    let m = moment.utc(dateStr, 'D MMM', true)

    // if the moment is invalid and the date string is '29 Feb', then assume that
    // the leap year is for the next year and re-initialize the moment
    if (!m.isValid() && dateStr === '29 Feb') {
      m = moment.utc(`${dateStr} ${new Date().getFullYear() + 1}`, 'D MMM YYYY', true)
    }

    if (m.isValid()) {
      return outbound ?
        query.closestDeparture(m) :
        query.closestReturn(m)
    }
    return null
  }

  parseTime(str) {
    const regexMathces = str.match(/([0-9]{1,2}:[0-9]{1,2})\s*([AaMmPpMm]{2}),\s*(\S{3}),\s*(\S{3})\s*([0-9]{1,2})/)
    const timeStr = regexMathces[1]
    const isPm = regexMathces[2].toLowerCase() === 'pm'
    const hour = parseInt(timeStr.split(':')[0])
    const minutes = timeStr.split(':')[1]
    let time = `${hour}:${minutes}`

    if (!isPm && hour === 12) {
      time = `00:${minutes}`
    } else if (isPm && hour !== 12) {
      time = `${hour + 12}:${minutes}`
    } else if (hour < 10) {
      time = `0${hour}:${minutes}`
    }

    return time
  }

  parseQuantity(ele) {
    if (ele) {
      const str = ele.text().trim()
      const result = reQuantity.exec(str)
      if (result) {
        return parseInt(result[1])
      }
    }
    return null
  }

  parseCabinFromAward(ele) {
    const displayCodes = {
      'coach-fare': cabins.economy,
      'business-fare': cabins.business,
      'first-fare': cabins.first
    }

    for (let cabinClass in displayCodes) {
      if (ele.attribs.class.indexOf(cabinClass) !== -1) {
        return displayCodes[cabinClass]
      }
    }
  }

  parseCabinFromSegment($, ele, segmentIdx) {
    const cabinNames = {
      'Coach': cabins.economy,
      'Main': cabins.economy,
      'Business': cabins.business,
      'First Class': cabins.first
    }

    if ($(ele).attr('title') === 'Mixed cabin itinerary') {
      const cabinName = $($(ele).find('.mixed-cabin-dialog li')[segmentIdx]).find('.FlightNumber').last().text().trim()
      return cabinNames[cabinName]
    } else {
      return this.parseCabinFromAward(ele);
    }
  }

  parseMileageCost(ele) {
    const costText = ele.find('.Price').text()
    const regexMatches = costText.match(/\w*k/g)
    return parseInt(regexMatches[0].replace('k', '')) * 1000
  }

  parseFees(ele) {
    const feesText = ele.find('.Price').text()
    const regexMatches = feesText.match(/\$.*/g)
    return `${regexMatches[0].replace('$', '')} USD`
  }
}