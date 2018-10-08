const Parser = require('../base/parser')
const { cabins } = require('../consts')

// Regex patterns
const reQuantity = /(\d+)\s+left/i

module.exports = class extends Parser {
  parse (query, assets) {
    const $ = assets.html.find(x => x.name === 'results').$

    // Parse direct flights first
    const direct = this.parseFlights($, '.direct-flight-details')
    const connecting = this.parseFlights($, '.connecting-flights')

    return { awards: [...direct, ...connecting] }
  }

  parseFlights ($, sel) {
    // Iterate over flights
    const awards = []
    $(sel).each((_, row) => {
      // Iterate over each segment
      const segments = []
      $(row).find('.travel-time-detail').each((_, x) => {
        // Calculate departure / arrival times
        const departDate = this.parseDate($(x).find('p.departdate').first().text().trim(), 'd LLL')
        const departTime = $(x).find('p.departtime').first().text().trim()
        const arrivalDate = this.parseDate($(x).find('p.arrivaldate').first().text().trim(), 'd LLL')
        const arrivalTime = $(x).find('p.arrivaltime').first().text().trim()

        // Add segment
        const airports = $(x).find('p.airport-code')
        const flightInfo = $(x).find('p.career-and-flight').first().text().split('-')
        const flightNumber = flightInfo[flightInfo.length - 1].trim()
        segments.push({
          airline: flightNumber.substring(0, 2),
          flight: flightNumber,
          fromCity: airports.eq(0).text().trim(),
          toCity: airports.eq(1).text().trim(),
          date: departDate.toSQLDate(),
          departure: departTime,
          arrival: arrivalTime,
          lagDays: this.computeLagDays(departDate, arrivalDate)
        })
      })

      // Get cabins / quantity for award
      $(row).find('div[class^="flightCabin"]').each((_, x) => {
        if ($(x).find('label.txtAvlSlctCls').length) {
          const seatsLeft = $(x).find('.message-number-of-seats')
          const quantity = this.parseQuantity(seatsLeft) || Math.max(this.query.quantity, 7)
          const cabin = this.parseCabin($(x).find('.travel-class'))
          const fares = this.fares(cabin)
          awards.push({ cabin, quantity, fares, segments })
        }
      })
    })

    return awards
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
