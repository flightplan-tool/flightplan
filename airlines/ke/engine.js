const Engine = require('../_base/engine')
const { cabins } = require('../../lib/consts')
const { randomInt } = require('../../lib/utils')

const URL_FLIGHT_SEARCH = 'https://www.koreanair.com/global/en/booking/booking-gate.html#bookingChange'

class KEEngine extends Engine {
  constructor (options) {
    super()
    this.options = options
    this.prevQuery = {}
  }

  static get config () {
    return {
      id: 'KE',
      name: 'Korean Air',
      fares: {
        A: {cabin: cabins.first, saver: true},
        CS: {cabin: cabins.business, saver: true},
        YS: {cabin: cabins.economy, saver: true}
      },
      accountRequired: true,
      requestsPerHour: 85,
      throttlePeriod: 30 * 60,
      oneWaySupported: true,
      tripMinDays: 3,
      validation: {
        minDays: 1,
        maxDays: 355
      }
    }
  }

  async initialize () {
    try {
      // Setup browser
      this.browser = await this.newBrowser(this.options)

      // Navigate to the flight search page
      this.page = await this.newPage(this.browser, this.options, URL_FLIGHT_SEARCH)

      // Load from / to cities
      console.log('KE: Loading cities...')
      this.cities = await this.airportCodes()
      console.log(`KE: Found ${this.cities.size} cities`)

      // Login
      return await this.login()
    } catch (e) {
      throw e
    }
  }

  async airportCodes () {
    try {
      const { page } = this
      const codes = new Set()
      const reAirportCode = /^[A-Z]{3}$/

      // // Open up the city list
      await page.click('li.airports-departure-area button')
      await page.waitFor(500)
      await page.waitFor('#tabAirpotSelect a[role="tab"]', { visible: true })

      // Grab each city's airport code
      const idList = await page.$$eval('div.city-list > ul > li > a', items => {
        return items.map(x => x.getAttribute('data-code'))
      })
      for (const code of idList.filter(x => x && reAirportCode.exec(x))) {
        codes.add(code)
      }

      // Now close the modal
      await page.click('#cboxClose')

      return codes
    } catch (e) {
      throw e
    }
  }

  async isLoggedIn () {
    try {
      const { page } = this

      await Promise.race([
        page.waitFor('#skypassLoginButton', { visible: true }),
        page.waitFor('#skypassLogoutButton', { visible: true })
      ])

      return !!(await page.$('#skypassLogoutButton'))
    } catch (e) {
      return false
    }
  }

  async login () {
    try {
      console.log('KE: Logging in...')
      const { page } = this
      const { username, password } = this.options

      let attempts = 0
      while (true) {
        // Check whether we're logged in (or had too many attempts)
        const success = await this.isLoggedIn()
        if (success || attempts >= 4) {
          console.log(`KE: Login ${success ? 'success' : 'failure'}!`)
          return success
        }

        // Do another attempt
        attempts++
        if (attempts === 2) {
          console.log('KE: 2nd login attempt...')
        } else if (attempts === 3) {
          console.log('KE: 3rd login attempt...')
        } else if (attempts === 4) {
          console.log('KE: 4th and final login attempt...')
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
        await page.click('#usernameInput')
        await this.clear('#usernameInput')
        await page.keyboard.type(username, { delay: 10 })
        await page.click('#passwordInput')
        await this.clear('#passwordInput')
        await page.keyboard.type(password, { delay: 10 })

        // Check remember box, and submit the form
        await page.click('#modalLoginButton')
        await page.waitFor(1000)
      }
    } catch (e) {
      throw e
    }
  }

  async search (query) {
    try {
      const {
        fromCity,
        toCity,
        departDate,
        returnDate,
        cabin,
        quantity
      } = query
      const { page } = this

      // Validate from / to
      if (!this.cities.has(fromCity)) {
        console.log(`KE: Invalid From city: ${fromCity}`)
        return false
      } else if (!this.cities.has(toCity)) {
        console.log(`KE: Invalid To city: ${toCity}`)
        return false
      }

      // If not logged in, do that again
      if (!await this.isLoggedIn()) {
        if (!await this.login()) {
          throw new Error('KE: Login failed!')
        }
      }

      // Check if we can reuse search results page from previous query
      let reuseForm = false
      const changeSearchSel = '#award-avenue > div.change-avail div.booking-ct-btn > button'
      if (
        this.canReuseQuery(query) &&
        await page.$(changeSearchSel) &&
        !(await page.$('div.award-cal')) // Make sure we're not stuck on flexible dates calendar
      ) {
        // Open up the built-in form
        await page.click(changeSearchSel)
        reuseForm = true
      } else {
        // Go to flight search page
        await page.goto(URL_FLIGHT_SEARCH, {waitUntil: 'networkidle0'})

        // Select "Award Booking"
        const awardSel = '#booking-type button[data-name="award"]'
        await page.waitFor(awardSel)
        await page.click(awardSel)

        // Select "Korean Air award" (not SkyTeam)
        await page.click('#sta-kr')

        // Choose One-Way or Round-Trip
        await page.click(`#from-to-chooser input[value="${returnDate ? 'roundtrip' : 'oneway'}"]`)
      }
      this.prevQuery = {} // Clear previous query

      // Set origin and destination
      await this.setCity('li.airports-departure-area input.fromto-input', fromCity)
      await this.setCity('li.airports-arrival-area input.fromto-input', toCity)

      // Set departure and return dates
      const dateInputSel = 'div.dateholder input.tripdetail-input'
      await page.click(dateInputSel)
      await this.clear(dateInputSel)
      const dates = returnDate ? [departDate, returnDate] : [departDate]
      const strDates = dates.map(x => x.format('YYYY-MM-DD')).join('/')
      await page.keyboard.type(strDates, { delay: 10 })
      await page.keyboard.press('Tab')

      if (!reuseForm) {
        // Set cabin class
        const cabinOptions = {
          [cabins.economy]: 'economy',
          [cabins.business]: 'prestige',
          [cabins.first]: 'first'
        }
        if (!(cabin in cabinOptions)) {
          this.error(`Invalid cabin class: ${cabin}`)
          return
        }
        const cabinSel = `div.cabin-class input[value="${cabinOptions[cabin]}"]`
        await page.click(cabinSel)
        if (!page.$(cabinSel + ':checked')) {
          console.log('KE: Could not set cabin to:', cabin)
          return false
        }

        // Set the # of passengers
        // if (!await this.select('#adult\\3a count', quantity.toString())) {
        //   console.log('KE: Could not set # of adults to:', quantity)
        //   return
        // }
      }

      // Submit the search form
      const submitSel = !reuseForm ? '#submit' : '#award-avenue > div.change-avail div.booking-ct-btn > input[value="Search"'
      const [response] = await Promise.all([
        page.waitForNavigation({waitUntil: 'networkidle0'}),
        this.submitForm(submitSel)
      ])
      await this.settle()

      // Any form submission errors?
      try {
        await page.waitFor('#booking-gate-from-to-chooser-error p.error', { visible: true, timeout: 500 })
        return false
      } catch (e) {}

      // Insert a small wait
      await page.waitFor(randomInt(5, 10) * 1000)

      // Save HTML and screenshot
      await this.save(query, page)

      // Check response code
      if (!response.ok()) {
        console.log(`KE: Received non-OK HTTP Status Code: ${response.status()}`)
        return false
      }

      // Update previous query
      this.prevQuery = {...query, oneWay: !returnDate}

      // Success!
      return true
    } catch (e) {
      throw e
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

  clear (selector) {
    return this.page.evaluate((selector) => {
      document.querySelector(selector).value = ''
    }, selector)
  }

  async submitForm (submitSel) {
    const { page } = this

    // Hit submit first
    await page.click(submitSel)
    await page.waitFor(1000)

    // Check for popups
    while (true) {
      try {
        // Check if we got a popup
        const dontShowAgainSel = '#popsession-checkbox'
        if (await page.$(dontShowAgainSel)) {
          await page.click(dontShowAgainSel)
          await page.waitFor(500)
        }
        const confirmSel = '#cboxLoadedContent div.btn-area.tcenter > button'
        if (await page.$(confirmSel)) {
          await page.click(confirmSel)
          await page.waitFor(1000)
        } else {
          // No popup detected, break out
          break
        }
      } catch (e) {}
    }
  }

  async settle () {
    try {
      const { page } = this

      // While loading bar exists, keep waiting...
      while (true) {
        await page.waitFor(250)
        if (!await page.$('div.loading-bar')) {
          break
        }

        // If we hit a modal popup while results were loading, then return
        if (await page.$('#btnModalPopupYes')) {
          break
        }
      }
    } catch (e) {
      throw e
    }
  }

  canReuseQuery (query) {
    query = {...query, oneWay: !query.returnDate}
    const fields = ['fromCity', 'toCity', 'cabin', 'quantity', 'oneWay']
    return !fields.find(x => query[x] !== this.prevQuery[x])
  }
}

module.exports = KEEngine
