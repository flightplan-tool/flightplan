const Engine = require('../_base/engine')
const { cabins } = require('../../lib/consts')
const { appendPath, randomInt } = require('../../lib/utils')

const URL_FLIGHT_SEARCH = 'https://api.asiamiles.com/ibered/jsp/redeem-flights/asia-miles-flight-award-redemption.jsp?ENTRYCOUNTRY=HK&ENTRYLANGUAGE=en&ENTRYPOINT=asiamiles.com'

class CXEngine extends Engine {
  constructor (options) {
    super()
    this.options = options
  }

  static get config () {
    return {
      id: 'CX',
      name: 'Cathay Pacific',
      fares: {
        FS: {cabin: cabins.first, saver: true},
        F1: {cabin: cabins.first, saver: false},
        F2: {cabin: cabins.first, saver: false},
        CS: {cabin: cabins.business, saver: true},
        C1: {cabin: cabins.business, saver: false},
        C2: {cabin: cabins.business, saver: false},
        WS: {cabin: cabins.premium, saver: true},
        W1: {cabin: cabins.premium, saver: false},
        W2: {cabin: cabins.premium, saver: false},
        YS: {cabin: cabins.economy, saver: true},
        Y1: {cabin: cabins.economy, saver: false},
        Y2: {cabin: cabins.economy, saver: false}
      },
      accountRequired: true,
      requestsPerHour: 30,
      throttlePeriod: 15 * 60,
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

      // To see available cities, we need to login first
      if (!await this.login()) {
        return false
      }

      // Load from / to cities
      console.log('CX: Loading cities...')
      this.cities = await this.airportCodes(
        '#byDest-city-from-alink', '#as_byDest-city-from > ul'
      )
      console.log(`CX: Found ${this.cities.size} cities`)

      return true
    } catch (e) {
      throw e
    }
  }

  async airportCodes (btn, selector) {
    try {
      const { page } = this
      await page.waitFor(1000)

      // We first need to click on the list, so it gets populated. However, it sometimes
      // disappears unexpectedly, so keep trying until we clicked it successfully.
      const cities = new Set()
      let attempts = 0
      while (true) {
        if (attempts > 10) {
          throw new Error('Failed to load city list successfully')
        }
        attempts++

        // Wait for button to be visible, then try to click it
        await page.waitFor(btn, { visible: true })
        await page.click(btn)

        // Check if the list is visible now
        try {
          await page.waitFor(selector, { visible: true, timeout: 1000 })
          break
        } catch (e) {}
      }

      // Get list of cities
      const reAirportCode = /\(([A-Z]{3})\)(?!.*\([A-Z]{3}\))/
      const items = await page.$$eval(selector + ' > li', items => (
        items.map(li => li.innerText)
      ))
      items.forEach(text => {
        const match = reAirportCode.exec(text)
        if (match) {
          cities.add(match[1])
        }
      })

      return cities
    } catch (e) {
      throw e
    }
  }

  async isLoggedIn () {
    try {
      const { page } = this

      await Promise.race([
        page.waitFor('#login-welcomemsg', { visible: true }),
        page.waitFor('#account-login div.form-login-wrapper button.btn-primary', { visible: true })
      ])

      return !!(await page.$('#login-welcomemsg'))
    } catch (e) {
      return false
    }
  }

  async login () {
    try {
      console.log('CX: Logging in...')
      const { page } = this
      const { username, password } = this.options

      let attempts = 0
      while (true) {
        // Check whether we're logged in (or had too many attempts)
        const success = await this.isLoggedIn()
        if (success || attempts >= 4) {
          console.log(`CX: Login ${success ? 'success' : 'failure'}!`)
          return success
        }

        // Do another attempt
        attempts++
        if (attempts === 2) {
          console.log('CX: 2nd login attempt...')
        } else if (attempts === 3) {
          console.log('CX: 3rd login attempt...')
        } else if (attempts === 4) {
          console.log('CX: 4th and final login attempt...')
        }

        // Enter username and password
        await page.click('#memID')
        await this.clear('#memID')
        await page.keyboard.type(username, { delay: 10 })
        await page.click('#memPIN')
        await this.clear('#memPIN')
        await page.keyboard.type(password, { delay: 10 })
        await page.waitFor(250)

        // Check remember box
        await page.click('label[for=checkRememberMe]')
        await page.waitFor(250)

        // Submit form, and give the landing page up to 5 seconds to load
        try {
          await Promise.all([
            page.waitForNavigation({waitUntil: 'networkidle0', timeout: 5000}),
            page.click('#account-login div.form-login-wrapper button.btn-primary')
          ])
        } catch (e) {}

        // Go to the flight search page (which will show us if we're logged in or not)
        await page.goto(URL_FLIGHT_SEARCH, {waitUntil: 'networkidle0'})
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
        console.log(`CX: Invalid From city: ${fromCity}`)
        return false
      } else if (!this.cities.has(toCity)) {
        console.log(`CX: Invalid To city: ${toCity}`)
        return false
      }

      // Go to flight search page
      await page.goto(URL_FLIGHT_SEARCH, {waitUntil: 'networkidle0'})

      // If not logged in, do that again
      if (!await this.isLoggedIn()) {
        if (!await this.login()) {
          throw new Error('CX: Login failed!')
        }
      }

      // Search by destination, not miles
      await page.waitFor('#byDest', { visible: true })
      await page.click('#byDest')

      // Make sure cities are loaded, before typing them in
      await this.airportCodes(
        '#byDest-city-from-alink', '#as_byDest-city-from > ul'
      )

      // Set origin and destination
      const fromSel = '#byDest-city-from'
      await page.click(fromSel)
      await this.clear(fromSel)
      await page.keyboard.type(fromCity, { delay: 10 })
      await page.waitFor(1000)
      await page.keyboard.press('Tab')
      await page.waitFor(1000)
      const toSel = '#byDest-city-to'
      await page.click(toSel)
      await this.clear(toSel)
      await page.waitFor(1000)
      await page.keyboard.type(toCity, { delay: 10 })
      await page.waitFor(1000)
      await page.keyboard.press('Tab')

      // Set Round-Trip or One-Way drop-down
      if (!await this.select('#byDest-trip-type', returnDate ? 'R' : 'O')) {
        console.log('CX: Could not set trip type to:', returnDate ? 'Round-Trip' : 'One-Way')
        return false
      }

      // Set cabin class
      const cabinOptions = {
        [cabins.economy]: 'Y',
        [cabins.premium]: 'W',
        [cabins.business]: 'C',
        [cabins.first]: 'F'
      }
      if (!(cabin in cabinOptions)) {
        this.error(`Invalid cabin class: ${cabin}`)
        return
      }
      if (!await this.select('#byDest-trip-class1', cabinOptions[cabin])) {
        console.log('CX: Could not set cabin to:', cabin)
        return false
      }

      // Set departure date
      await page.evaluate((strDate) => {
        document.querySelector('#byDest-txtDateDepart').value = strDate
      }, departDate.format('DD-MMM-YYYY'))

      // Set return date
      if (returnDate) {
        await page.evaluate((strDate) => {
          document.querySelector('#byDest-txtDateReturn').value = strDate
        }, returnDate.format('DD-MMM-YYYY'))
      }

      // Set the # of adults
      if (!await this.select('#byDest-adult', quantity.toString())) {
        console.log('CX: Could not set # of adults to:', quantity)
        return
      }

      // Select fixed travel dates
      await page.click('#byDest-radio')
      await page.waitFor(500)

      // Insert a small wait
      await page.waitFor(randomInt(8, 10) * 1000)

      // Save the main page results first
      if (!await this.saveResults('#btnSearch', query, page)) {
        return false
      }

      // Now save the results for tab "Priority Awards Tier 1"
      await page.waitFor('#PT1Tab > a', { visible: true })
      await page.waitFor(1000)
      if (!await this.saveResults('#PT1Tab > a', query, page, '-1')) {
        return false
      }

      // Finally, save the results for tab "Priority Awards Tier 2"
      await page.waitFor('#PT2Tab > a', { visible: true })
      await page.waitFor(1000)
      if (!await this.saveResults('#PT2Tab > a', query, page, '-2')) {
        return false
      }

      // Success!
      return true
    } catch (e) {
      throw e
    }
  }

  async saveResults (btnSelector, query, page, fileIdx) {
    const [response] = await Promise.all([
      page.waitForNavigation({waitUntil: 'networkidle2'}),
      page.click(btnSelector)
    ])
    await this.settle()

    // Inject file index
    if (fileIdx) {
      query = {
        ...query,
        screenshot: appendPath(query.screenshot, fileIdx),
        htmlFile: appendPath(query.htmlFile, fileIdx)
      }
    }

    // Insert a small wait
    await page.waitFor(randomInt(3, 5) * 1000)

    // Save HTML and screenshot
    await this.save(query, page)

    // Check response code
    if (!response.ok()) {
      console.log(`CX: Received non-OK HTTP Status Code: ${response.status()}`)
      return false
    }

    return true
  }

  clear (selector) {
    return this.page.evaluate((selector) => {
      document.querySelector(selector).value = ''
    }, selector)
  }

  async select (selector, value) {
    try {
      const { page } = this
      await page.select(selector, value)
      await page.waitFor(250)
      return value === await page.$eval(selector, x => x.value)
    } catch (e) {
      throw e
    }
  }

  async settle () {
    try {
      const { page } = this

      // Wait a tiny bit, for things to run
      await page.waitFor(250)
      await page.waitFor('div.wait-message', { hidden: true })
      await page.waitFor(1000)
    } catch (e) {
      throw e
    }
  }
}

module.exports = CXEngine
