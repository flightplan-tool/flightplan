const moment = require('moment-timezone')
const timetable = require('timetable-fns')

const Searcher = require('../../Searcher')
const { cabins } = require('../../consts')

module.exports = class extends Searcher {
  async isLoggedIn (page) {
    // Sometimes the page keeps reloading out from under us
    return this.retry(async () => {
      try {
        await page.waitFor(1000)
        await page.waitFor('#execLoginrForm, li.memberName', { timeout: 5000 })
      } catch (err) {}
      return !!(await page.$('li.memberName'))
    })
  }

  async login (page, credentials) {
    const [ username, password ] = credentials
    if (!username || !password) {
      throw new Searcher.Error(`Missing login credentials`)
    }

    // Enter username and password
    await this.clear('#membershipNumber')
    await page.click('#membershipNumber')
    await page.waitFor(1000)
    await page.keyboard.type(username, { delay: 10 })
    await this.clear('#input_password')
    await page.click('#input_password')
    await page.waitFor(1000)
    await page.keyboard.type(password, { delay: 10 })
    await page.waitFor(250)

    // Check remember box, and submit the form
    if (!await page.$('#rememberMe:checked')) {
      await page.click('#showRememberModalIcon')
      await page.waitFor(250)
    }
    await this.clickAndWait('#ecuserlogbutton')

    // Check if we're blocked
    const msg = await this.textContent('#main-content h1')
    if (msg.includes('page is not available')) {
      throw new Searcher.Error(`Website blocked access during login`)
    }
  }

  async search (page, query, results) {
    const { oneWay, fromCity, toCity, cabin, quantity } = query
    const departDate = query.departDateMoment()
    const returnDate = query.returnDateMoment()

    // Wait a few seconds for the form to auto-fill itself
    await page.waitFor(3000)

    // Get cabin values
    const cabinCode = {
      [cabins.first]: 'F',
      [cabins.business]: 'C',
      [cabins.premium]: 'W',
      [cabins.economy]: 'M'
    }

    await this.fillForm({
      pageid: 'PLANREDEMPTIONJOURNEY',
      tab_selected: 'redeem',
      redemption_type: 'STD_RED',
      departurePoint: fromCity,
      destinationPoint: toCity,
      departInputDate: departDate.format('MM/DD/YY'),
      returnInputDate: returnDate ? returnDate.format('MM/DD/YY') : '',
      oneWay: oneWay,
      CabinCode: cabinCode[cabin],
      NumberOfAdults: quantity.toString(),
      NumberOfYoungAdults: '0',
      NumberOfChildren: '0',
      NumberOfInfants: '0'
    })

    // Disable return input date if one-way
    await page.evaluate((oneWay) => {
      document.getElementsByName('returnInputDate')[0].disabled = oneWay
    }, oneWay)

    // Submit the form
    await this.submitForm('plan_redeem_trip')

    // Wait for results to load
    await this.settle()

    // Save the results
    await results.saveHTML('results')
  }

  async settle () {
    const { page } = this

    while (true) {
      try {
        await Promise.race([
          page.waitFor('#blsErrors li', { timeout: 120000 }),
          page.waitFor('#captcha_form', { timeout: 120000 }),
          page.waitFor('#noStopovers', { timeout: 120000 }),
          page.waitFor('#flt_selection_form', { timeout: 120000 })
        ])
      } catch (err) {
        throw new Searcher.Error(`Stuck waiting for results to appear`)
      }

      // Check for catpcha
      if (await page.$('#captcha_form')) {
        this.warn(`CAPTCHA detected, please submit solution to continue...`)
        await page.waitForNavigation(this.config.waitUntil)
        continue
      }

      // Check for stopover form
      if (await page.$('#noStopovers')) {
        await page.click('#noStopovers')
        await page.waitFor(500)
        await this.clickAndWait('#continueTopPod')
        continue
      }

      // Check for errors
      const msgError = await this.textContent('#blsErrors li')
      if (msgError) {
        throw new Searcher.Error(msgError)
      }

      // Ensure results exist
      if (!(await page.$('#flt_selection_form'))) {
        throw new Searcher.Error('Unable to locate flight results')
      }
      break
    }
  }

  async modify (page, diff, query, lastQuery, results) {
    const { departDate, returnDate } = query

    // We only support +/- 3 days
    const departDiff = timetable.diff(lastQuery.departDate, departDate)
    const returnDiff = query.oneWay ? 0 : timetable.diff(lastQuery.returnDate, returnDate)
    if (
      Math.abs(departDiff) > 3 ||
      Math.abs(returnDiff) > 3 ||
      (departDiff === 0 && returnDiff === 0)) {
      return false
    }

    // Update each sector
    if (departDiff !== 0) {
      await this.chooseDateTab(departDate, 0)
    }
    if (returnDiff !== 0) {
      await this.chooseDateTab(returnDate, 1)
    }

    // Wait for the page to finish loading, and save results
    await results.saveHTML('results')

    // Success!
    return true
  }

  async chooseDateTab (date, sector) {
    const ts = moment.utc(date).valueOf()
    const opts = { SectorNumber: sector }
    if (sector === 0) {
      // Departure tab
      opts.selectedDateRadio_1 = ts
      opts.selectedDate_1 = ts
    } else {
      // Arrival tab
      opts.selectedDateRadio_2 = ts
      opts.selectedDate_2 = ts
    }
    await this.fillForm(opts)

    // Submit form
    await this.submitForm('TabSelection')

    // Wait for results to finish loading
    await this.settle()
  }
}
