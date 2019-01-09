const Searcher = require('../../Searcher')

const { errors } = Searcher

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
      throw new errors.MissingCredentials()
    }

    // Enter username and password
    await this.enterText('#accountNumber', username)
    await this.enterText('#password', password)

    // Check remember box, and submit the form
    await page.click('#rememberLogin')
    await page.waitFor(250)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('#amcMemberLogin')
    ])
    await this.settle()

    // Check for errors
    const msgError = await this.textContent('.modalError div.dialogMessage')
    if (msgError.includes('verify your membership number')) {
      throw new errors.InvalidCredentials()
    }
  }

  async search (page, query, results) {
    const { fromCity, toCity, quantity, oneWay } = query
    const departDate = query.departDateMoment()
    const returnDate = oneWay ? departDate : query.returnDateMoment()

    // Wait a little bit for the form to load
    await page.waitFor(1000)

    // Choose multiple cities / mixed classes
    await this.clickAndWait('li.lastChild.deselection')
    await page.waitFor(1000)

    await this.fillForm({
      'requestedSegment:0:departureAirportCode:field': fromCity,
      'requestedSegment:1:arrivalAirportCode:field': fromCity,
      'requestedSegment:0:departureAirportCode:field_pctext': await this.airportName(fromCity),
      'requestedSegment:1:arrivalAirportCode:field_pctext': await this.airportName(fromCity),
      'requestedSegment:0:arrivalAirportCode:field': toCity,
      'requestedSegment:1:departureAirportCode:field': toCity,
      'requestedSegment:0:arrivalAirportCode:field_pctext': await this.airportName(toCity),
      'requestedSegment:1:departureAirportCode:field_pctext': await this.airportName(toCity),
      'requestedSegment:0:departureDate:field': departDate.format('YYYYMMDD'),
      'requestedSegment:0:departureDate:field_pctext': departDate.format('MM/DD/YYYY (dd)').toUpperCase(),
      'requestedSegment:1:departureDate:field': returnDate.format('YYYYMMDD'),
      'requestedSegment:1:departureDate:field_pctext': returnDate.format('MM/DD/YYYY (dd)').toUpperCase(),
      'adult:count': quantity.toString(),
      'youngAdult:count': 0,
      'child:count': 0
    })

    // Use logged-in user's status to check award availability
    if (await page.$('#travelArranger:checked')) {
      await page.click('#travelArranger')
    }
    await page.waitFor(500)

    // Submit the form
    const response = await this.clickAndWait('input[value="Search"]')
    await this.settle()

    // Check response code
    this.checkResponse(response)

    // Save airports (need the names to map back to codes later)
    const airports = await page.evaluate(() => {
      const { airports } = Asw.AirportList
      return { airports }
    })
    await results.saveJSON(`airports`, airports)

    // Save outbound flights
    await this.save('outbound', results)

    // If roundtrip, select a flight and move to the next page
    if (!oneWay) {
      const radioButton = await page.$('i[role="radio"]')
      if (radioButton) {
        await radioButton.click()
        await this.waitBetween(3000, 6000)
        await this.clickAndWait('#nextButton')
        await this.settle()

        // Save inbound flights
        await this.save('inbound', results)
      }
    }
  }

  async save (name, results) {
    // Check for errors
    await this.checkPage()

    // Save the results
    await results.saveHTML(name)
    await results.screenshot(name)
  }

  async settle () {
    // CAPTCHA indicates we're being blocked based on IP address
    const msg = await this.textContent('#reCaptchaDescription')
    if (msg.includes('prevent fraudulent manipulation')) {
      throw new errors.BlockedAccess()
    }

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

    if (await this.visible('.modalError')) {
      const msg = await this.textContent('.modalError', '')
      if (msg.toLowerCase().includes('there are errors')) {
        throw new Searcher.Error(`The website returned an error: ${msg}`)
      }
    }

    if (await page.$('#cmnContainer .messageArea')) {
      const msg = await this.textContent('#cmnContainer .messageArea', '')
      await page.click('#cmnContainer .buttonArea input')
      throw new Searcher.Error(`The website returned an error: ${msg}`)
    }
  }
}
