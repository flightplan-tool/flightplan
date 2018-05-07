const Engine = require('../_base/engine')
const { cabins } = require('../../lib/consts')

const URL_FLIGHT_SEARCH = 'https://aswbe-i.ana.co.jp/international_asw/pages/award/search/roundtrip/award_search_roundtrip_input.xhtml?CONNECTION_KIND=JPN&LANG=en'

class NHEngine extends Engine {
  constructor (options) {
    super()
    this.options = options
  }

  static get config () {
    return {
      id: 'NH',
      name: 'All Nippon Airways',
      fares: {
        FS: {cabin: cabins.first, saver: true},
        CS: {cabin: cabins.business, saver: true},
        YS: {cabin: cabins.economy, saver: true}
      },
      accountRequired: true,
      requestsPerHour: 85,
      throttlePeriod: 30 * 60,
      oneWaySupported: false,
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
      console.log('NH: Loading cities...')
      this.cities = await this.airportCodes()
      console.log(`NH: Found ${this.cities.size} cities`)

      return true
    } catch (e) {
      throw e
    }
  }

  async airportCodes () {
    try {
      const { page } = this
      const codes = new Set()
      const reAirportCode = /^[A-Z]{3}$/

      // Open up the city list
      await page.click('a.paxFormIconAirport.paxFormIconSelect')
      await page.waitFor(100)
      await page.waitFor('a.countryIndex', { visible: true })

      // Iterate through the country links
      for (const country of await page.$$('a.countryIndex')) {
        await country.click()
        await page.waitFor(100)

        // Grab each city's airport code
        const idList = await page.$$eval('div.airportSection li > a', items => (
          items.map(x => x.id)
        ))
        for (const code of idList.filter(x => x && reAirportCode.exec(x))) {
          codes.add(code)
        }
      }

      return codes
    } catch (e) {
      throw e
    }
  }

  async isLoggedIn () {
    try {
      const { page } = this

      await Promise.race([
        page.waitFor('li.btnLogoutArea', { visible: true }),
        page.waitFor('#accountNumber', { visible: true })
      ])

      return !!(await page.$('li.btnLogoutArea'))
    } catch (e) {
      return false
    }
  }

  async login () {
    try {
      console.log('NH: Logging in...')
      const { page } = this
      const { username, password } = this.options

      let attempts = 0
      while (true) {
        // Check whether we're logged in (or had too many attempts)
        const success = await this.isLoggedIn()
        if (success || attempts >= 4) {
          console.log(`NH: Login ${success ? 'success' : 'failure'}!`)
          return success
        }

        // Do another attempt
        attempts++
        if (attempts === 2) {
          console.log('NH: 2nd login attempt...')
        } else if (attempts === 3) {
          console.log('NH: 3rd login attempt...')
        } else if (attempts === 4) {
          console.log('NH: 4th and final login attempt...')
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
        console.log(`NH: Invalid From city: ${fromCity}`)
        return false
      } else if (!this.cities.has(toCity)) {
        console.log(`NH: Invalid To city: ${toCity}`)
        return false
      }

      // Go to flight search page
      await page.goto(URL_FLIGHT_SEARCH, {waitUntil: 'networkidle0'})

      // If not logged in, do that again
      if (!await this.isLoggedIn()) {
        if (!await this.login()) {
          throw new Error('NH: Login failed!')
        }
      }

      // Make sure form is ready
      await this.settle()

      // Make sure round-trip is selected (one-way not supported)
      const roundTripSel = '#roundTripOpenJawSelected\\3a openJaw01\\3a radioItem'
      await page.waitFor(roundTripSel, { visible: true })
      await page.click(roundTripSel)
      await this.settle()

      // Set origin and destination
      await this.setCity('#departureAirportCode\\3a field_pctext', fromCity)
      await this.setCity('#arrivalAirportCode\\3a field_pctext', toCity)

      // Set departure and return dates
      await this.setDate('#awardDepartureDate\\3a field_pctext', departDate)
      await this.setDate('#awardReturnDate\\3a field_pctext', returnDate)

      // Set cabin class
      const cabinOptions = {
        [cabins.economy]: 'CFF1',
        [cabins.business]: 'CFF2',
        [cabins.first]: 'CFF3'
      }
      if (!(cabin in cabinOptions)) {
        this.error(`Invalid cabin class: ${cabin}`)
        return
      }
      if (!await this.select('#boardingClass', cabinOptions[cabin])) {
        console.log('NH: Could not set cabin to:', cabin)
        return false
      }

      // Set the # of adults
      if (!await this.select('#adult\\3a count', quantity.toString())) {
        console.log('NH: Could not set # of adults to:', quantity)
        return
      }

      // Make sure travel dates are fixed
      if (await page.$('#comparisonSearchType:checked')) {
        await page.click('#comparisonSearchType')
        await this.settle()
      }

      // Submit the search form
      const [response] = await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('#itinerarySearch > div.areaSeparate > p.btnFloat > input')
      ])
      await this.settle()

      // Make sure we're looking at NH awards, not *A
      if (!await page.$('#selectAward01:checked')) {
        await page.click('#selectAward01')
      }

      // Save HTML and screenshot
      await this.save(query, page)

      // Check response code
      if (!response.ok()) {
        console.log(`NH: Received non-OK HTTP Status Code: ${response.status()}`)
        return false
      }

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

  async setDate (selector, date) {
    const { page } = this
    const strDate = date.format('YYYY-MM-DD')
    await page.click(selector)
    await page.waitFor(1000) // Wait for calendar to open up
    await page.click(`td[abbr="${strDate}"]`)
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
      await page.waitFor('div.loadingArea', { hidden: true })
      await page.waitFor(1000)
    } catch (e) {
      throw e
    }
  }
}

module.exports = NHEngine
