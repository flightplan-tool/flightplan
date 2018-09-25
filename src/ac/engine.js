const Engine = require('../base/engine')
const { cabins } = require('../consts')

module.exports = class extends Engine {
  async isLoggedIn (page) {
    await page.waitFor(
      'button.header-login-btn, a.header-logout-btn', {visible: true, timeout: 10000})
    return !!(await page.$('a.header-logout-btn'))
  }

  async login (page, credentials) {
    const [ username, password ] = credentials
    if (!username || !password) {
      return { error: `Missing login credentials` }
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

  validate (query) {}

  async search (page, query) {
    const { oneWay, fromCity, toCity, departDate, returnDate, cabin, quantity } = query

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
        l1Oneway: departDate.format('MM/DD/YYYY'),
        l1OnewayDate: departDate.format('YYYY-MM-DD'),
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
        l1Return: departDate.format('MM/DD/YYYY'),
        l1ReturnDate: departDate.format('YYYY-MM-DD'),
        r1Return: returnDate.format('MM/DD/YYYY'),
        r1ReturnDate: returnDate.format('YYYY-MM-DD'),
        ReturnCabinTextfield: cabinVals[0],
        ReturnCabin: cabinVals[1],
        ReturnAdultsNb: '1',
        ReturnChildrenNb: '0',
        ReturnTotalPassengerNb: '1',
        ReturnFlexibleDatesHidden: '0'
      })
    }

    // Submit the form, and capture the AJAX response
    const { responses, error } = await this.submitForm(oneWay
      ? 'travelFlightsOneWayTab'
      : 'travelFlightsRoundTripTab',
      { capture: '/adr/Results_Ajax.jsp' })
    if (error) {
      return { error }
    }

    // Wait for the AJAX response to finish loading
    try {
      await responses.json()
    } catch (err) {
      return { error: err.message }
    }

    // Obtain the AJAX from the browser itself, which will have calculated prices
    const json = await page.evaluate(() => this.results.results)
    let ret = await this.saveJSON('results', json)
    if (ret && ret.error) {
      return ret
    }
  }
}
