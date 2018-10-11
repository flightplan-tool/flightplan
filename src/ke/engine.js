const Engine = require('../base/engine')
const { cabins } = require('../consts')

module.exports = class extends Engine {
  async isLoggedIn (page) {
    await Promise.race([
      page.waitFor('#skypassLoginButton', { visible: true }).catch(e => {}),
      page.waitFor('#skypassLogoutButton', { visible: true }).catch(e => {})
    ])
    return !!(await page.$('#skypassLogoutButton'))
  }

  async login (page, credentials) {
    const [ username, password ] = credentials
    if (!username || !password) {
      return { error: `Missing login credentials` }
    }

    // If login form not shown, click login link
    if (!await page.$('#usernameInput')) {
      await page.waitFor('#skypassLoginButton', { visible: true })
      await page.click('#skypassLoginButton')
      await page.waitFor('#login-skypass', { visible: true })
    }

    // Login using SKYPASS #
    await page.click('#login-skypass')
    await page.waitFor(500)

    // Enter username and password
    await page.waitFor('#usernameInput', { visible: true })
    await page.click('#usernameInput')
    await this.clear('#usernameInput')
    await page.keyboard.type(username, { delay: 10 })
    await page.click('#passwordInput')
    await this.clear('#passwordInput')
    await page.keyboard.type(password, { delay: 10 })

    // Submit the form
    await page.click('#modalLoginButton')
    await page.waitFor('#login-skypass', { hidden: true })
    await page.waitFor(500)
  }

  validate (query) {
    const { partners, oneWay, cabin } = query
    if (partners && oneWay) {
      return { error: `KE does not support searching one-way partner awards` }
    }
    if (cabin === cabins.premium) {
      return { error: `KE does not support the premium economy award class` }
    }
  }

  async search (page, query) {
    const { partners, oneWay, fromCity, toCity, departDate, returnDate, cabin } = query

    // Select "Award Booking"
    const awardSel = '#booking-type button[data-name="award"]'
    await page.waitFor(awardSel)
    await page.click(awardSel)

    // Select "SkyTeam" or "Korean Air" award type based on whether we're searching partners
    await page.click(partners ? '#sta-sk' : '#sta-kr')

    // Set from / to cities
    await this.setCity('li.airports-departure-area input.fromto-input', fromCity)
    await this.setCity('li.airports-arrival-area input.fromto-input', toCity)

    // Set trip type
    await page.click(`#from-to-chooser input[value="${oneWay ? 'oneway' : 'roundtrip'}"]`)

    // Fill out the date selector
    const dateInputSel = 'div.dateholder input.tripdetail-input'
    await page.click(dateInputSel)
    await this.clear(dateInputSel)
    const dates = oneWay ? [departDate] : [departDate, returnDate]
    const strDates = dates.map(x => x.toFormat('yyyy-MM-dd')).join('/')
    await page.keyboard.type(strDates, { delay: 10 })
    await page.keyboard.press('Tab')

    // Set cabin
    const cabinOptions = {
      [cabins.economy]: 'economy',
      [cabins.business]: 'prestige',
      [cabins.first]: 'first'
    }
    if (!(cabin in cabinOptions)) {
      return { error: `Invalid cabin class: ${cabin}` }
    }
    const cabinSel = `div.cabin-class input[value="${cabinOptions[cabin]}"]`
    await page.click(cabinSel)
    if (!await page.$(cabinSel + ':checked')) {
      return { error: `Could not set cabin to: ${cabin}` }
    }

    // Capture response
    return this.saveResponse(async () => {
      // Submit the search form
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 180000 }),
        this.clickSubmit('#submit')
      ])
    })
  }

  async modify (page, diff, query, prevQuery) {
    // Get old and new dates
    const { departDate, returnDate } = this.query
    const { departDate: oldDepartDate, returnDate: oldReturnDate } = this.prevQuery

    return this.saveResponse(async () => {
      // Attempt to choose the dates directly
      if (await this.chooseDateTab('ul.date-outbound-column', oldDepartDate, departDate)) {
        if (!returnDate || await this.chooseDateTab('ul.date-inbound-column', oldReturnDate, returnDate)) {
          return
        }
      }
      return { success: false }
    })
  }

  async saveResponse (callback) {
    const { page } = this

    let fn = null
    let resp = null
    try {
      // Setup response handler
      fn = (response) => {
        if (response.url().includes('/api/fly/award/')) {
          resp = response
        }
      }
      page.on('response', fn)

      // Call the submit callback (response may get set several times here,
      // we want the last occurrence)
      let ret = await callback()
      if (ret && (ret.error || (ret.success === false))) {
        return ret
      }

      // Insert a small wait (to make sure response is set)
      await this.waitBetween([5, 10])
    } finally {
      if (fn) {
        page.removeListener('response', fn)
      }
    }

    // Inspect the API response
    let json = {}
    if (!resp) {
      return { error: 'Expected API response was not found: /api/fly/award/...' }
    }
    try {
      json = await resp.json()
      return this.saveJSON('results', json)
    } catch (err) {
      return { error: `Failed to parse API response: ${err}` }
    }
  }

  async setCity (selector, value) {
    const { page } = this
    await page.click(selector)
    await this.clear(selector)
    await page.keyboard.type(value, { delay: 10 })
    await page.waitFor(1000)
    await page.keyboard.press('Tab')
  }

  async chooseDateTab (selector, oldDate, newDate) {
    const { page } = this

    // We only support +/- 3 days
    const diff = newDate.diff(oldDate, 'days').as('days')
    if (Math.abs(diff) > 3 || diff === 0) {
      return false
    }

    // Locate the tabs
    const tabs = await page.$(selector)
    if (!tabs) {
      return false
    }

    // Get the dates associated with tabs
    let tabData = await tabs.$$eval('li.date-tab a', items => {
      return items.map(x => [ x.getAttribute('data-index'), x.getAttribute('data-name') ])
    })
    newDate = newDate.toFormat('MM/dd')
    const newSel = tabData.find(x => x[1] === newDate)
    if (!newSel) {
      return false
    }

    // Click the tab
    await page.click(`${selector} li.date-tab a[data-index="${newSel[0]}"]`)

    return true
  }

  async clickSubmit (submitSel) {
    const { page } = this

    // Hit submit first
    await page.click(submitSel)

    // Check for popups
    while (true) {
      const confirm1 = '#cboxLoadedContent #btnModalPopupYes'
      const dontShowAgain1 = '#airpmessage-checkbox'
      const confirm2 = '#cboxLoadedContent div.btn-area.tcenter > button'
      const dontShowAgain2 = '#popsession-checkbox'

      try {
        await Promise.race([
          page.waitFor(confirm1, { visible: true, timeout: 5000 }),
          page.waitFor(confirm2, { visible: true, timeout: 5000 })
        ])
      } catch (err) {
        break
      }

      await this.dismissPopup(dontShowAgain1, confirm1)
      await this.dismissPopup(dontShowAgain2, confirm2)
    }
  }

  async dismissPopup (dontShowAgainSel, confirmSel) {
    const { page } = this

    try {
      if (await page.$(confirmSel)) {
        // Check the box to not show again, then dismiss the popup
        if (await page.$(dontShowAgainSel)) {
          await page.click(dontShowAgainSel)
          await page.waitFor(500)
        }
        await page.click(confirmSel)
        await page.waitFor(1000)
      }
    } catch (err) {
      // Spurious context errors arise here sometimes, just try again...
      this.warn(err)
    }
  }
}
