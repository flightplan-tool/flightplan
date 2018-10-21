const Engine = require('../base/engine')
const { cabins } = require('../consts')

module.exports = class extends Engine {
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
      return { error: `Missing login credentials` }
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
  }

  validate (query) {}

  async search (page, query) {
    const { oneWay, fromCity, toCity, departDate, returnDate, cabin, quantity } = query

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
      departInputDate: departDate.toFormat('MM/dd/yy'),
      returnInputDate: returnDate ? returnDate.toFormat('MM/dd/yy') : '',
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
    let ret = await this.submitForm('plan_redeem_trip')
    if (ret && ret.error) {
      return ret
    }

    while (true) {
      // Wait for results to finish loading
      await this.settle()

      // Check for captcha form
      if (await page.$('#captcha_form')) {
        return { error: 'Blocked by captcha' }
      }

      // Check for stopover form
      if (await page.$('#noStopovers')) {
        await page.click('#noStopovers')
        await page.waitFor(500)
        await page.click('#continueTopPod')
        continue
      }

      // Check for errors
      ret = await this.checkPage()
      if (ret && ret.error) {
        return ret
      }
      break
    }

    // Save the results
    ret = await this.saveHTML('results')
    if (ret && ret.error) {
      return ret
    }
  }

  async settle () {
    const { page } = this

    // Give the interstitial page a chance to load
    await page.waitFor(2000)

    // Wait for spinner
    await this.monitor('#interstitial-spinner', 5000)

    // Give the results page a chance to load
    await page.waitFor(3000)
  }

  async modify (page, diff, query, prevQuery) {
    // We only support +/- 3 days
    const departDiff = query.departDate.diff(prevQuery.departDate, 'days').days
    const returnDiff = query.oneWay ? 0 : query.returnDate.diff(prevQuery.returnDate, 'days').days
    if (
      Math.abs(departDiff) > 3 ||
      Math.abs(returnDiff) > 3 ||
      (departDiff === 0 && returnDiff === 0)) {
      return { success: false }
    }

    // Update each sector
    if (departDiff !== 0) {
      let ret = await this.chooseDateTab(query.departDate, 0)
      if (ret && ret.error) {
        return ret
      }
    }
    if (returnDiff !== 0) {
      let ret = await this.chooseDateTab(query.returnDate, 1)
      if (ret && ret.error) {
        return ret
      }
    }

    // Wait for the page to finish loading, and save results
    return this.saveHTML('results')
  }

  async chooseDateTab (date, sector) {
    const ts = date.valueOf()
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
    let ret = await this.submitForm('TabSelection')
    if (ret && ret.error) {
      return ret
    }

    // Wait for results to finish loading
    const { page } = this
    await this.settle(page)

    // Check for errors
    ret = await this.checkPage(page)
    if (ret && ret.error) {
      return ret
    }
  }

  async checkPage () {
    const { page } = this

    const msgError = await this.textContent('#blsErrors li')
    if (msgError) {
      return { error: msgError }
    }

    if (!await page.$('#flt_selection_form')) {
      return { error: 'Unable to locate flight results' }
    }
  }
}
