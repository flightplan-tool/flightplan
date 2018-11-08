const Searcher = require('../../Searcher')
const { cabins } = require('../../consts')

module.exports = class extends Searcher {
  async isLoggedIn (page) {
    await page.waitFor(
      'button.header-login-btn, a.header-logout-btn', {visible: true, timeout: 10000})
    return !!(await page.$('a.header-logout-btn'))
  }

  async login (page, credentials) {
    const [ username, password ] = credentials
    if (!username || !password) {
      throw new Searcher.Error(`Missing login credentials`)
    }

    // Enter username and password
    await page.click('#cust')
    await page.waitFor(1000)
    await page.keyboard.type(username, { delay: 10 })
    await page.click('#pin')
    await page.waitFor(1000)
    await page.keyboard.type(password, { delay: 10 })
    await page.waitFor(250)

    // Check remember box, and submit the form
    if (!await page.$('div.checkbox input:checked')) {
      await page.click('div.checkbox input')
      await page.waitFor(250)
    }
    await this.clickAndWait('button.btn-primary.form-login-submit')
  }

  async search (page, query, results) {
    const { oneWay, fromCity, toCity, cabin, quantity } = query
    const departDate = query.departDateObject()
    const returnDate = query.returnDateObject()

    // Wait a few seconds for the form to auto-fill itself
    await page.waitFor(3000)

    // Get cabin values
    const cabinVals = [cabins.first, cabins.business].includes(cabin)
      ? ['Business/First', 'Business']
      : ['Eco/Prem', 'Economy']

    // Fill out the form
    if (oneWay) {
      await this.fillForm({
        tripTypeOneWay: 'One-way',
        currentTripTab: 'oneway',
        city1FromOnewayCode: fromCity,
        city1ToOnewayCode: toCity,
        l1Oneway: departDate.toFormat('MM/dd/yyyy'),
        l1OnewayDate: departDate.toFormat('yyyy-MM-dd'),
        OnewayCabinTextfield: cabinVals[0],
        OnewayCabin: cabinVals[1],
        OnewayAdultsNb: quantity.toString(),
        OnewayChildrenNb: '0',
        OnewayTotalPassengerNb: quantity.toString(),
        OnewayFlexibleDatesHidden: '0'
      })
    } else {
      await this.fillForm({
        tripTypeRoundTrip: 'Round-Trip',
        currentTripTab: 'return',
        city1FromReturnCode: fromCity,
        city1ToReturnCode: toCity,
        l1Return: departDate.toFormat('MM/dd/yyyy'),
        l1ReturnDate: departDate.toFormat('yyyy-MM-dd'),
        r1Return: returnDate.toFormat('MM/dd/yyyy'),
        r1ReturnDate: returnDate.toFormat('yyyy-MM-dd'),
        ReturnCabinTextfield: cabinVals[0],
        ReturnCabin: cabinVals[1],
        ReturnAdultsNb: '1',
        ReturnChildrenNb: '0',
        ReturnTotalPassengerNb: '1',
        ReturnFlexibleDatesHidden: '0'
      })
    }

    // Submit the form, and capture the AJAX response
    await this.submitForm(oneWay
      ? 'travelFlightsOneWayTab'
      : 'travelFlightsRoundTripTab',
      { waitUntil: 'none' })

    // Check if a new tab opened
    await page.waitFor(2000)
    const pages = await this.browser.pages()
    const oldPage = page
    page = pages[pages.length - 1]
    this.page = page

    // Wait for results to load
    await this.monitor('.waiting-spinner-inner')

    // Obtain the JSON from the browser itself, which will have calculated prices
    const json = await page.evaluate(() => this.results.results)
    await results.saveJSON('results', json)
    await results.screenshot('results')

    // If a new tab was opened, we can close it now and restore the old page
    if (page !== oldPage) {
      this.page = oldPage
      await page.close()
    }
  }
}
