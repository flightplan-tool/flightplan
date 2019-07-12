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
const reQuantity = /(\d+)\s+left/i

module.exports = class extends Parser {
  parse(results) {
    const $ = results.$('results')

    return this.parseFlights($)
  }

  parseFlights($) {
    const {
      engine,
      query
    } = this.results

    // Iterate over flights
    const awards = []
    $('.fareDetails').each((i, row) => {
      let originCity = null
      let outbound = null
      let departDate = null
      let arrivalTime = null

      // Iterate over each segment
      const segments = []
      $('.ui-dialog-content.compareCabin').eq(i).find('.flightDetailsSection').each((_, x) => {
        // Get cities, and direction
        const airports = $(x).find('.flightDate').children().eq(1).text().trim().match(/\(\S{3}\)/g)
        const fromCity = airports[0].replace(/[\(\)]/g, '')
        const toCity = airports[1].replace(/[\(\)]/g, '')
        if (!originCity) {
          originCity = fromCity
          outbound = (originCity === query.fromCity)
        }

        // Get departure / arrival dates
        let leavesNextDay = false
        const strDepartDate = $(x).find('.flightDate').children().eq(0).text().trim()
        departDate = this.parseDate(strDepartDate, query, outbound)
        const departTime = $(x).find('.flightTimingChild').eq(0).find('.flightDetailSectionText').text().trim()
        if (arrivalTime) {
          // if we already have departDate set, then we need to compare the previous
          // segment's arrival time with this segments departure time because the day
          // may have changed
          const arrivalHour = parseInt(arrivalTime.split(':')[0])
          const departHour = parseInt(departTime.split(':')[0])
          if (departHour < arrivalHour) {
            departDate = departDate.add(1, 'days')
            leavesNextDay = true
          }
        }

        arrivalTime = $(x).find('.flightTimingChild').eq(1).find('.flightDetailSectionText').text().trim()
        let arrivalDate = this.parseDate(departDate.format('ddd D MMM YYYY'), query, outbound)
        if (arrivalTime.indexOf('+1day') !== -1) {
          arrivalDate = arrivalDate.add(1, 'days')
          arrivalTime = arrivalTime.replace('+1day', '').trim()
        }

        // Add segment
        const flightNumber = $(x).find('.flightTimingChild').eq(3).find('.flightDetailSectionText').text().trim()
        const aircraft = $(x).find('.flightTimingChild').eq(4).find('.flightDetailSectionText').text().trim()
        segments.push(new Segment({
          aircraft: aircraft,
          airline: flightNumber.substring(0, 2),
          flight: flightNumber,
          fromCity,
          toCity,
          date: departDate,
          departure: departTime,
          arrival: arrivalTime,
          lagDays: utils.daysBetween(departDate, arrivalDate) + (leavesNextDay ? 1 : 0)
        }))
      })

      // Get cabins / quantity for award
      $(row).find('.fm_pricingmain, .fm_pricingecon, .fm_pricingprem').each((_, x) => {
        const cabinClassArr = x.attribs.class.split(' ').filter(a => a.indexOf('fm_pricing') === 0)
        if (cabinClassArr[0]) {
          const cabinClass = cabinClassArr[0].replace('fm_pricing', '')

          const flight = new Flight(segments)
          const quantity = query.quantity
          const cabin = this.parseCabin(cabinClass)
          const fare = this.findFare(cabin)
          const cabins = flight.segments.map(x => cabin)
          const mileageStr = $(x).find('.hideMe .showPaxPrice').text().trim()
          const mileageCost = mileageStr ? parseInt(mileageStr.replace(',', '')) : null
          const feesStr = $(x).find('.fm_miles').children().not('.milesText.showTotalPaxPrice').text().replace('$', '').trim()
          const fees = `${feesStr} USD`

          awards.push(new Award({
            engine,
            fare,
            cabins,
            quantity,
            mileageCost,
            fees
          }, flight))
        }
      })
    })

    return awards
  }

  parseDate(str, query, outbound) {
    let m = moment.utc(str, 'ddd D MMM YYYY', true)

    if (m.isValid()) {
      return outbound ?
        query.closestDeparture(m) :
        query.closestReturn(m)
    }
    return null
  }

  parseCabin(fare) {
    const displayCodes = {
      'prem': cabins.business,
      'econ': cabins.premium,
      'main': cabins.economy
    }
    return displayCodes[fare]
  }
}