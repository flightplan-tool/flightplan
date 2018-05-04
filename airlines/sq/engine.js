const fs = require('fs')
const moment = require('moment')
const puppeteer = require('puppeteer')

const applyEvasions = require('../../lib/evasions')
const { randomInt, printRoute } = require('../../lib/utils')
const { isBlocked } = require('./helpers')

const REQUESTS_PER_HOUR = 85
const THROTTLE_PERIOD = 30 * 60

const URL_FLIGHT_SEARCH = 'https://www.singaporeair.com/en_UK/ppsclub-krisflyer/flightsearch/'

class Engine {
  constructor (options) {
    this._options = options
    this._start = moment()
    this._requests = 0
  }

  async initialize () {
    try {
      console.log('SQ: Initializing...')

      // Launch the browser in headless mode and set up a page.
      this._browser = await puppeteer.launch({
        args: ['--use-gl'],
        headless: this._options.headless
      })

      // Navigate to the flight search page
      this.page = await this.newPage(URL_FLIGHT_SEARCH)
      const { page } = this

      // Make sure we're in redeem flights mode (to see all the *A cities)
      await page.waitFor('#travel-radio-2', {visible: true})
      await page.click('#travel-radio-2')

      // Load from / to cities
      console.log('SQ: Loading cities...')
      this._from = await this.cityMap('#cib-flight3 > option')
      this._to = await this.cityMap('#cib-flight4 > option')
      console.log(`SQ: Found ${Math.max(this._from.size, this._to.size)} cities`)

      // Login
      return await this.login()
    } catch (e) {
      throw e
    }
  }

  async newPage (url) {
    try {
      const page = await this._browser.newPage()
      page.setViewport({width: randomInt(1150, 1450), height: randomInt(850, 1050)})
      page.setDefaultNavigationTimeout(this._options.timeout)
      await applyEvasions(page)
      if (this._options.cookies) {
        await page.setCookie(...this._options.cookies)
      }
      if (url) {
        await page.goto(url, {waitUntil: 'networkidle2'})
      }
      return page
    } catch (e) {
      throw e
    }
  }

  async cityMap (selector) {
    try {
      const { page } = this
      const cities = new Map()

      // Wait for the selector to exist
      await page.waitFor(selector)

      // Get list of cities
      const cityCount = await page.evaluate((sel) => {
        return document.querySelectorAll(sel).length
      }, selector)

      for (let i = 1; i <= cityCount; i++) {
        const citySel = `${selector}:nth-child(${i})`
        const [value, name] = await page.evaluate((sel) => {
          const ele = document.querySelector(sel)
          return [ele.getAttribute('data-text'), ele.text]
        }, citySel)
        const code = /-\s+(\w+)\s*/.exec(value)
        if (code) {
          cities.set(code[1], name)
        }
      }

      return cities
    } catch (e) {
      throw e
    }
  }

  async isLoggedIn () {
    try {
      const { page } = this
      await page.waitFor(
        '#membership-1, a.login, li.logged-in', {visible: true, timeout: 10000})
      return !!(await page.$('li.logged-in'))
    } catch (e) {
      return false
    }
  }

  async login () {
    try {
      console.log('SQ: Logging in...')
      const { page } = this
      const { username, password } = this._options

      let attempts = 0
      while (true) {
        // Check whether we're logged in (or had too many attempts)
        const success = await this.isLoggedIn()
        if (success || attempts >= 4) {
          console.log(`SQ: Login ${success ? 'success' : 'failure'}!`)
          return success
        }

        // Do another attempt
        attempts++
        if (attempts === 2) {
          console.log('SQ: 2nd login attempt...')
        } else if (attempts === 3) {
          console.log('SQ: 3rd login attempt...')
        } else if (attempts === 4) {
          console.log('SQ: 4th and final login attempt...')
        }

        // Check if the login form is visible
        let formVisible = true
        try {
          await page.waitFor('#membership-1', {visible: true, timeout: 1000})
        } catch (e) {
          formVisible = false
        }

        if (!formVisible) {
          // Click the login link
          const login = await page.waitFor('a.login', {visible: true})
          await login.asElement().click()
          await page.waitFor('#membership-1', {visible: true})
        }

        // Bypass invisible captcha, if present
        const bypassed = await page.evaluate(() => {
          if (typeof captchaSubmit === 'function') {
            captchaSubmit()
            return true
          }
          return false
        })
        if (bypassed) {
          console.log('SQ: Detected and bypassed invisible captcha')
        } else {
          // Enter username and password
          await page.click('#membership-1')
          await page.keyboard.type(username)
          await page.click('#membership-2')
          await page.keyboard.type(password)

          // Check remember box, and submit the form
          await page.click('#checkbox-1')
          await page.click('#submit-1')
        }

        // Give time to start processing and complete
        await page.waitForNavigation({waitUntil: 'networkidle2'})
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
        cabinClass,
        adults,
        children,
        htmlFile,
        screenshot
      } = query
      const { page } = this

      // Validate from / to
      if (!this._from.has(fromCity)) {
        console.log(`SQ: Invalid From city: ${fromCity}`)
        return
      } else if (!this._to.has(toCity)) {
        console.log(`SQ: Invalid To city: ${toCity}`)
        return
      }

      // Validate depart / return dates
      if (!departDate.isValid()) {
        console.log(`SQ: Invalid departure date: ${departDate}`)
      } else if (!departDate.isBetween(moment(), moment().add(1, 'years'))) {
        console.log(`SQ: Departure date not between today and 365 days from now: ${departDate}`)
      }
      if (returnDate) {
        if (!returnDate.isValid()) {
          console.log(`SQ: Invalid return date: ${returnDate}`)
        } else if (!returnDate.isBetween(departDate, moment().add(1, 'years'))) {
          console.log(`SQ: Return date not between departure date and 365 days from now: ${returnDate}`)
        }
      }

      // Throttle before executing search
      await this.throttle()

      // Print route(s) being searched
      printRoute(query)

      // Go to flight search page
      await page.goto(URL_FLIGHT_SEARCH, {waitUntil: 'networkidle2'})

      // If not logged in, do that again
      if (!this.isLoggedIn()) {
        if (!this.login()) {
          throw new Error('SQ Login failed!')
        }
      }

      // Check the Redeem Flights radio button
      await page.click('#travel-radio-2')
      await page.waitFor(500)

      // Set origin and destination
      await page.evaluate((value) => {
        document.getElementById('city1-1').value = value
      }, this._from.get(fromCity))
      await page.evaluate((value) => {
        document.getElementById('city1-2').value = value
      }, this._to.get(toCity))
      await page.waitFor(500)

      // Select Round-Trip or One-Way radio button
      if (returnDate) {
        await page.waitFor('#city1-radio-4', {visible: true})
        await page.click('#city1-radio-4')
      } else {
        await page.waitFor('#city1-radio-5', {visible: true})
        await page.click('#city1-radio-5')
      }
      await page.waitFor(500)

      // Set departure date
      // await page.click(returnDate ? '#city1-travel-start-day' : '#city1-travel-start-day-2')
      // await page.keyboard.type(departDate.format('DDMMYYYY'), {delay: 50})
      // await page.keyboard.press('Tab')

      // Multiple departure date inputs with same name, make sure they're all set
      await page.evaluate((strDate) => {
        document.querySelector('#city1-travel-start-day').value = strDate
        document.querySelector('#city1-travel-start-day-2').value = strDate
      }, departDate.format('DD/MM/YYYY'))
      await page.waitFor(500)

      // Set return date
      if (returnDate) {
        // await page.click('#city1-travel-return-day')
        // await page.keyboard.type(returnDate.format('DDMMYYYY'), {delay: 50})
        // await page.keyboard.press('Tab')
        await page.evaluate((strDate) => {
          document.querySelector('#city1-travel-return-day').value = strDate
        }, returnDate.format('DD/MM/YYYY'))
        await page.waitFor(500)
      }

      // Set cabin class
      const classOptions = {
        Y: 'economy',
        W: 'premiumeconomy',
        C: 'business',
        F: 'firstSuite'
      }
      if (!(cabinClass in classOptions)) {
        console.log('SQ: Invalid cabin class:', cabinClass)
        return
      }
      if (!(await this.select('#customSelect-4-combobox',
      'li[id^="customSelect-4-option-"]', classOptions[cabinClass]))) {
        console.log('SQ: Could not set cabin class to:', classOptions[cabinClass])
        return
      }

      // Set the # of adults and children
      if (!await this.select('#customSelect-5-combobox',
      'li[id^="customSelect-5-option-"]', adults.toString())) {
        console.log('SQ: Could not set # of adults to:', adults)
        return
      }
      if (!await this.select('#customSelect-6-combobox',
      'li[id^="customSelect-6-option-"]', children.toString())) {
        console.log('SQ: Could not set # of children to:', adults)
      }

      // Submit the form
      await page.waitFor(randomInt(500, 1000))
      await page.click('#form-book-travel-1 #city-travel-input-2')
      const response = await page.waitForNavigation({waitUntil: 'networkidle2'})

      // Screenshot page if requested
      if (screenshot) {
        await page.screenshot({path: screenshot})
      }

      // Get the full HTML content and write it out
      const html = await page.evaluate(() => document.body.innerHTML)
      if (htmlFile) {
        fs.writeFileSync(htmlFile, html)
      }

      // Check response code
      if (!response.ok()) {
        console.log(`SQ: Received non-OK HTTP Status Code: ${response.status()}`)
        return false
      }

      // Check if we were blocked
      if (isBlocked(html)) {
        const delay = randomInt(65, 320)
        console.log(`SQ: Blocked by server, waiting for ${moment().add(delay, 's').fromNow(true)}`)
        await page.waitFor(delay * 1000)
        return false
      }

      // Success!
      return true
    } catch (e) {
      throw e
    }
  }

  async select (selComboBox, selListItems, value) {
    try {
      const { page } = this

      // Click the combo box first, to open it up
      await page.click(selComboBox)

      // Find the list item we want to select
      const listItems = await page.evaluate((sel) => {
        // Convert list items to a map of form: Value => ID
        const results = [...document.querySelectorAll(sel)]
        return results.reduce((map, x) => {
          map[x.getAttribute('data-value')] = '#' + x.getAttribute('id')
          return map
        }, {})
      }, selListItems)
      const id = listItems[value]
      if (!id) {
        return false
      }

      // Select the item
      await page.waitFor(id, {visible: true})
      await page.click(id)

      return true
    } catch (e) {
      throw e
    }
  }

  async getCookies () {
    try {
      return await this.page.cookies()
    } catch (e) {
      return []
    }
  }

  async close () {
    try {
      if (this._browser) {
        await this._browser.close()
        this._browser = null
      }
    } catch (e) {
      throw e
    }
  }

  async throttle () {
    try {
      const limit = REQUESTS_PER_HOUR / 3600 * THROTTLE_PERIOD
      if (this._requests >= limit) {
        // Sleep until end of period, to provide a cool-down period
        this._start.add(THROTTLE_PERIOD, 's')
        const delayMillis = this._start.diff()
        if (delayMillis > 0) {
          console.log(`*** Cool-down period, resuming ${this._start.fromNow()} ***`)
          await this.page.waitFor(delayMillis)
        }
        this._requests = 0
        this._start = moment()
      }
      this._requests++
    } catch (e) {
      throw e
    }
  }
}

module.exports = Engine
