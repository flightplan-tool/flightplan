const Engine = require('../base/engine')
const { cabins } = require('../consts')

module.exports = class extends Engine {
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
      return { error: `Missing login credentials` }
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
      return { error: `Unsupported cabin class: ${query.cabin}` }
    }

    // One way searches are not supported
    if (oneWay) {
      return { error: `One-way award search is not supported by this engine` }
    }
  }

  async search (page, query) {
    const { fromCity, toCity, departDate, returnDate, cabin, quantity } = query

    // Wait a little bit for the form to load
    await page.waitFor(1000)

    // Get cabin values
    const cabinCode = {
      [cabins.economy]: 'CFF1',
      [cabins.business]: 'CFF2',
      [cabins.first]: 'CFF3'
    }

    // Weekday strings
    const weekdays = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

    await this.fillForm({
      'hiddenSearchMode': 'ROUND_TRIP',
      'itineraryButtonCheck': 'roundTrip',
      'hiddenAction': 'AwardRoundTripSearchInputAction',
      'roundTripOpenJawSelected:radioGroup': '0',
      'hiddenRoundtripOpenJawSelected': '0',
      'departureAirportCode:field': fromCity,
      'departureAirportCode:field_pctext': await this.airportName(fromCity),
      'arrivalAirportCode:field': toCity,
      'arrivalAirportCode:field_pctext': await this.airportName(toCity),
      'awardDepartureDate:field': departDate.format('YYYYMMDD'),
      'awardDepartureDate:field_pctext': departDate.format('MM/DD/YYYY') + ` (${weekdays[departDate.day()]})`,
      'awardReturnDate:field': returnDate.format('YYYYMMDD'),
      'awardReturnDate:field_pctext': returnDate.format('MM/DD/YYYY') + ` (${weekdays[returnDate.day()]})`,
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
    let ret = this.validResponse(response)
    if (ret && ret.error) {
      return ret
    }

    // Check for errors
    ret = await this.checkPage()
    if (ret && ret.error) {
      return ret
    }

    // Obtain the JSON data from the browser itself
    const json = await page.evaluate(() => {
      const { recommendationList, awardExcludeList } = this
      const { inboundFlightInfoList, outboundFlightInfoList } = Asw.SummaryArea
      return {
        recommendationList,
        awardExcludeList,
        inboundFlightInfoList,
        outboundFlightInfoList
      }
    })
    ret = await this.saveJSON('results', json)
    if (ret && ret.error) {
      return ret
    }
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
      return { error: 'The website encountered an error processing the request' }
    }
  }
}
