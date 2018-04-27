const fs = require('fs')
const path = require('path')
const moment = require('moment')
const puppeteer = require('puppeteer')

const applyEvasions = require('../lib/evasions')
const { randomInt } = require('../lib/utils')

const REQUESTS_PER_HOUR = 198
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
      this._page = await this.newPage(URL_FLIGHT_SEARCH)
      await this._page.waitFor('#travel-radio-2', {visible: true})

      // Load from / to cities
      console.log('SQ: Loading cities...')
      this._from = await this.cityMap('#cib-flight3 > option')
      this._to = await this.cityMap('#cib-flight4 > option')
      console.log(`SQ: Found ${Math.max(this._from.size, this._to.size)} cities`)

      // Login
      return this.login()
    } catch (e) {
      throw e
    }
  }

  async newPage (url) {
    try {
      const page = await this._browser.newPage()
      page.setViewport({width: randomInt(1150, 1450), height: randomInt(850, 1050)})
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
      const cities = new Map()

      // Get list of cities
      const cityCount = await this._page.evaluate((sel) => {
        return document.querySelectorAll(sel).length
      }, selector)

      for (let i = 1; i <= cityCount; i++) {
        const citySel = `${selector}:nth-child(${i})`
        const [code, name] = await this._page.evaluate((sel) => {
          const ele = document.querySelector(sel)
          return [ele.getAttribute('value'), ele.text]
        }, citySel)
        cities.set(code, name)
      }

      return cities
    } catch (e) {
      throw e
    }
  }

  async isLoggedIn () {
    try {
      await this._page.waitFor(
        '#membership-1, a.login, li.logged-in', {visible: true, timeout: 10000})
      return !!(await this._page.$('li.logged-in'))
    } catch (e) {
      return false
    }
  }

  async login () {
    try {
      console.log('SQ: Logging in...')
      const page = this._page
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

  async search (options) {
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
      } = options
      const page = this._page

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
      const strPax = [
        adults === 0 ? undefined : (adults === 1) ? '1 Adult' : `${adults} Adults`,
        children === 0 ? undefined : (children === 1) ? '1 Child' : `${children} Children`
      ].filter(x => !!x).join(', ')
      console.log(`SQ: DEPARTURE [${fromCity} -> ${toCity}] - ${departDate.format('L')} (${strPax})`)
      if (returnDate) {
        console.log(`SQ: ARRIVAL   [${toCity} -> ${fromCity}] - ${returnDate.format('L')}`)
      }

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
      await this._page.evaluate((value) => {
        document.getElementById('city1-1').value = value
      }, this._from.get(fromCity))
      await this._page.evaluate((value) => {
        document.getElementById('city1-2').value = value
      }, this._to.get(toCity))
      await page.waitFor(500)

      // Select Round-Trip or One-Way radio button
      if (returnDate) {
        await page.click('#city1-radio-4')
      } else {
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
      await page.waitForNavigation({waitUntil: 'networkidle2', timeout: 5 * 60000})

      // Screenshot page if requested
      if (screenshot) {
        await page.screenshot({path: screenshot})
      }

      // Get the full HTML content and write it out
      if (htmlFile) {
        const html = await page.evaluate(() => document.body.innerHTML)
        const dir = path.dirname(htmlFile)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir)
        }
        fs.writeFileSync(htmlFile, html)
      }

      // Success!
      return true
    } catch (e) {
      throw e
    }
  }

  async select (selComboBox, selListItems, value) {
    try {
      const page = this._page

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
    return await this._page.cookies()
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
    const limit = REQUESTS_PER_HOUR / 3600 * THROTTLE_PERIOD
    if (this._requests >= limit) {
      // Sleep until end of period, to provide a cool-down period
      this._start.add(THROTTLE_PERIOD, 's')
      const delayMillis = this._start.diff()
      if (delayMillis > 0) {
        console.log(`*** Cool-down period, resuming ${this._start.fromNow()} ***`)
        await this._page.waitFor(delayMillis)
      }
      this._requests = 0
      this._start = moment()
    }
    this._requests++
  }
}

module.exports = Engine
