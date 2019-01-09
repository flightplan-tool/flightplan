const Searcher = require('../../Searcher')
const { cabins } = require('../../consts')

const { errors } = Searcher

module.exports = class extends Searcher {
  async isLoggedIn (page) {
    // Wait for page to finish loading
    await this.settle()

    // Check for blocked access
    const msgError = await this.textContent('div.pageHeading')
    if (msgError.toLowerCase().includes('access blocked')) {
      throw new errors.BlockedAccess()
    }

    // Check if we're logged in
    try {
      await page.waitFor(
        '#kfLoginPopup #membership-1, a.login, li.logged-in', {visible: true, timeout: 10000})
    } catch (err) {}
    return !!(await page.$('li.logged-in'))
  }

  async login (page, credentials) {
    const [ username, password ] = credentials
    if (!username || !password) {
      throw new errors.MissingCredentials()
    }

    // Dismiss popups
    await this.prepare()

    // Check if the login form is visible
    let formVisible = true
    try {
      await page.waitFor('#kfLoginPopup #membership-1', {visible: true, timeout: 1000})
    } catch (err) {
      formVisible = false
    }

    if (!formVisible) {
      // Click the login link
      const login = await page.waitFor('a.login', {visible: true})
      await login.asElement().click()
      await page.waitFor('#kfLoginPopup #membership-1', {visible: true})
      await page.waitFor(1000)
    }

    // Enter username and password
    await this.enterText('#kfLoginPopup #membership-1', username)
    await this.enterText('#kfLoginPopup #membership-2', password)

    // Check remember box, and submit the form
    if (!await page.$('#kfLoginPopup #checkbox-1:checked')) {
      await page.click('#kfLoginPopup #checkbox-1')
      await page.waitFor(250)
    }
    await this.clickAndWait('#kfLoginPopup #submit-1')
    await this.settle()

    // Bypass invisible captcha, if present
    const bypassed = await page.evaluate(() => {
      if (typeof captchaSubmit === 'function') {
        captchaSubmit()
        return true
      }
      return false
    })
    if (bypassed) {
      this.info('Detected and bypassed invisible captcha')
      await page.waitFor(3000)
      await this.settle()
      await page.waitFor(5000)
    }

    // Check for errors
    const msgError = await this.textContent('div.alert__message')
    if (msgError.includes('more tries to log in')) {
      throw new errors.InvalidCredentials()
    }
  }

  async search (page, query, results) {
    const { partners, fromCity, toCity, oneWay, cabin, quantity } = query
    const departDate = query.departDateMoment()
    const returnDate = query.returnDateMoment()

    // Make sure page is ready
    await this.prepare()

    // Check the Redeem Flights radio button
    await this.attemptWhile(
      async () => {
        return page.evaluate(() => !document.querySelector('#travel-radio-2').checked)
      },
      async () => {
        await page.waitFor('#travel-radio-2', { visible: true })
        await page.click('#travel-radio-2')
        await this.settle()
      },
      5,
      new Searcher.Error(`Failed to select "Redeem Flights" checkbox`)
    )

    // Check the Return or One-way radio button
    if (oneWay) {
      await page.waitFor('#city1-radio-5', {visible: true})
      await page.click('#city1-radio-5')
    } else {
      await page.waitFor('#city1-radio-4', {visible: true})
      await page.click('#city1-radio-4')
    }
    await this.settle()

    // Fill form values
    const cabinCode = {
      [cabins.first]: 'F',
      [cabins.business]: 'J',
      [cabins.premium]: 'S',
      [cabins.economy]: 'Y'
    }
    await this.fillForm({
      'orbOrigin': fromCity,
      'orbDestination': toCity,
      'departureMonth': departDate.format('DD/MM/YYYY'),
      'returnMonth': returnDate ? returnDate.format('DD/MM/YYYY') : '',
      'cabinClass': cabinCode[cabin],
      'numOfAdults': quantity.toString(),
      'numOfChildren': '0',
      'numOfChildNominees': 0,
      'numOfAdultNominees': 0
    })

    // There are extraneous inputs that need to be removed from form submission
    await page.evaluate(() => {
      document.querySelector('#form-book-travel-1 [name="destinationDropDown"]').name = ''
      document.querySelector('#city1-travel-start-day-2').name = ''
    })

    // Submit the form
    await this.submitForm('form-book-travel-1')
    await this.settle()

    // Check state of buttons
    const selBtn = '.orb-selectflight-btn-group > a:nth-of-type'
    const partnersExists = await page.$(`${selBtn}(2)`)
    const partnersActive = await page.$(`${selBtn}(2).active`)
    const partnersDisabled = await page.$(`${selBtn}(2).disabled`)

    // Save the results
    if (!partnersActive) {
      await results.saveHTML('results')
      await results.screenshot('results')
    } else {
      await results.saveHTML('partners1')
      await results.screenshot('partners1')
    }

    // If partners requested, check those as well
    if (partners && partnersExists && !partnersActive && !partnersDisabled) {
      await this.save(results, `${selBtn}(2)`, 'partners1')
    }
  }

  async save (results, sel, id) {
    const response = await this.clickAndWait(sel)
    await this.settle()

    // Check response code
    this.checkResponse(response)

    // Save the results
    await results.saveHTML(id)
    await results.screenshot(id)
  }

  async prepare () {
    const { page } = this

    // Ensure page is loaded, since we're only waiting until 'domcontentloaded' event
    await page.waitFor(1000)
    await this.settle()

    // Dismiss modal pop-up's
    while (true) {
      if (
        await this.clickIfVisible('div.cookie-continue') ||
        await this.clickIfVisible('div.insider-opt-in-disallow-button') ||
        await this.clickIfVisible('div.ins-survey-435-close')
      ) {
        await page.waitFor(2000)
        continue
      }
      break
    }
  }

  async settle () {
    // Wait for spinner
    await this.monitor('div.overlay-loading', 4000)

    // Check for survey pop-up
    await this.clickIfVisible('div[class^="ins-survey-"][class$="-close"]')
  }
}
