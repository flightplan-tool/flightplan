const Searcher = require('../../Searcher')
const { cabins } = require('../../consts')

module.exports = class extends Searcher {
  async isLoggedIn (page) {
    await Promise.race([
      page.waitFor('li.btnLogoutArea', { visible: true }).catch(e => {}),
      page.waitFor('#accountNumber', { visible: true }).catch(e => {})
    ])

    const loggedIn = !!(await page.$('li.btnLogoutArea'))

    // If not fully logged in, log out (in case saved AMC number is different)
    if (loggedIn && await page.$('#password')) {
      await this.clickAndWait('li.btnLogoutArea > a')

      // Go back to flight search page
      await page.goto(this.config.searchURL, {waitUntil: 'networkidle0'})
      return false
    }

    return loggedIn
  }

  async login (page, credentials) {
    const [ username, password ] = credentials
    if (!username || !password) {
      throw new Searcher.Error(`Missing login credentials`)
    }

    // Enter username and password
    await page.click('#accountNumber')
    await this.clear('#accountNumber')
    await page.keyboard.type(username, { delay: 10 })
    await page.click('#password')
    await this.clear('#password')
    await page.keyboard.type(password, { delay: 10 })

    // Check remember box, and submit the form
    await page.click('#rememberLogin')
    await page.waitFor(250)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('#amcMemberLogin')
    ])
    await this.settle()
  }

  validate (query) {
    const { cabin, oneWay } = query

    // Prem. economy is not a supported cabin
    if (cabin === cabins.premium) {
      throw new Searcher.Error(`Unsupported cabin class: ${query.cabin}`)
    }

    // One way searches are not supported
    if (oneWay) {
      throw new Searcher.Error(`One-way award search is not supported by this engine`)
    }
  }

  async search (page, query, results) {
    const { fromCity, toCity, cabin, quantity } = query
    const departDate = query.departDateObject()
    const returnDate = query.returnDateObject()

    // Wait a little bit for the form to load
    await page.waitFor(1000)

    // Get cabin values
    const cabinCode = {
      [cabins.economy]: 'CFF1',
      [cabins.business]: 'CFF2',
      [cabins.first]: 'CFF3'
    }

    // Weekday strings
    const weekdays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

    await this.fillForm({
      'hiddenSearchMode': 'ROUND_TRIP',
      'itineraryButtonCheck': 'roundTrip',
      'hiddenAction': 'AwardRoundTripSearchInputAction',
      'roundTripOpenJawSelected': '0',
      'hiddenRoundtripOpenJawSelected': '0',
      'departureAirportCode:field': fromCity,
      'departureAirportCode:field_pctext': await this.airportName(fromCity),
      'arrivalAirportCode:field': toCity,
      'arrivalAirportCode:field_pctext': await this.airportName(toCity),
      'awardDepartureDate:field': departDate.toFormat('yyyyMMdd'),
      'awardDepartureDate:field_pctext': departDate.toFormat('MM/dd/yyyy') + ` (${weekdays[departDate.weekday - 1]})`,
      'awardReturnDate:field': returnDate.toFormat('yyyyMMdd'),
      'awardReturnDate:field_pctext': returnDate.toFormat('MM/dd/yyyy') + ` (${weekdays[returnDate.weekday - 1]})`,
      'hiddenBoardingClassType': '0',
      'boardingClass': cabinCode[cabin],
      'adult:count': quantity.toString(),
      'youngAdult:count': 0,
      'hiddenDomesticChildAge': false,
      'child:count': 0
    })

    // Use logged-in user's status to check award availability
    if (await page.$('#travelArranger:checked')) {
      await page.click('#travelArranger')
    }

    // Make sure form is ready
    await this.settle()

    // Submit the form
    const response = await this.clickAndWait('#itinerarySearch input[type="submit"]')
    await this.settle()

    // Check response code
    this.checkResponse(response)

    // Check for errors
    await this.checkPage()

    // Save the results
    await results.saveHTML('results')

    // Obtain JSON data from the browser itself (for pricing)
    const json = await page.evaluate(() => {
      const { recommendationList, awardExcludeList } = this
      const { inboundFlightInfoList, outboundFlightInfoList } = Asw.SummaryArea
      const { airports } = Asw.AirportList
      return {
        recommendationList,
        awardExcludeList,
        inboundFlightInfoList,
        outboundFlightInfoList,
        airports
      }
    })
    await results.saveJSON('extra', json)
  }

  async settle () {
    // Wait for spinner
    await this.monitor('div.loadingArea')
    await this.page.waitFor(1000)
  }

  async airportName (code) {
    return this.page.evaluate((code) => {
      const airport = Asw.AirportList.airports.find(x => x.code === code)
      return airport ? airport.name : ''
    }, code)
  }

  async checkPage () {
    const { page } = this

    if (await page.$('#cmnContainer .messageArea')) {
      await page.click('#cmnContainer .buttonArea input')
      throw new Searcher.Error('The website encountered an error processing the request')
    }
  }
}
