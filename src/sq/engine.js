const Engine = require('../base/engine')
const { cabins } = require('../consts')

module.exports = class extends Engine {
  async initialize (page) {
    // Load airport codes
    this.info('Loading airports...')
    const { airports, error } = await airportCodes(this)

    // Check for any errors
    if (error) {
      return { error }
    }

    // Save the results
    this.airports = airports
    this.info(`Found ${airports.size} airports`)
  }

  async prepare (page) {
    // Ensure page is loaded, since we're only waiting until 'domcontentloaded' event
    await page.waitFor(1000)
    await settle(this)

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

  async isLoggedIn (page) {
    await page.waitFor(
      '#kfLoginPopup #membership-1, a.login, li.logged-in', {visible: true, timeout: 10000})
    return !!(await page.$('li.logged-in'))
  }

  async login (page) {
    const { username, password } = this.options
    if (!username || !password) {
      return { error: `Missing login credentials` }
    }

    // Check if the login form is visible
    let formVisible = true
    try {
      await page.waitFor('#kfLoginPopup #membership-1', {visible: true, timeout: 1000})
    } catch (e) {
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
    await page.click('#kfLoginPopup #membership-1')
    await page.waitFor(1000)
    await page.keyboard.type(username, { delay: 10 })
    await page.click('#kfLoginPopup #membership-2')
    await page.waitFor(1000)
    await page.keyboard.type(password, { delay: 10 })
    await page.waitFor(250)

    // Check remember box, and submit the form
    if (!await page.$('#kfLoginPopup #checkbox-1:checked')) {
      await page.click('#kfLoginPopup #checkbox-1')
      await page.waitFor(250)
    }
    await this.clickAndWait('#kfLoginPopup #submit-1', this.config.waitUntil)
    await settle(this)

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
      await settle(this)
      await page.waitFor(5000)
    }
  }

  validAirport (airport) {
    return this.airports.has(airport)
  }

  async setup (page) {
    // Check the Redeem Flights radio button
    await page.waitFor('#travel-radio-2', { visible: true })
    await page.click('#travel-radio-2')
    await settle(this)
  }

  async setFromCity (page, city) {
    await this.setValue('#city1-1', this.airports.get(city))
    await settle(this)
  }

  async setToCity (page, city) {
    await this.setValue('#city1-2', this.airports.get(city))
    await settle(this)
  }

  async setOneWay (page, oneWay) {
    if (oneWay) {
      await page.waitFor('#city1-radio-5', {visible: true})
      await page.click('#city1-radio-5')
    } else {
      await page.waitFor('#city1-radio-4', {visible: true})
      await page.click('#city1-radio-4')
    }
    await settle(this)
  }

  async setDepartDate (page, departDate) {
    // Multiple departure date inputs with same name, make sure they're all set
    departDate = departDate.format('DD/MM/YYYY')
    await this.setValue('#city1-travel-start-day', departDate)
    await this.setValue('#city1-travel-start-day-2', departDate)
    await settle(this)
  }

  async setReturnDate (page, returnDate) {
    returnDate = returnDate.format('DD/MM/YYYY')
    await this.setValue('#city1-travel-return-day', returnDate)
    await settle(this)
  }

  async setCabin (page, cabin) {
    const classOptions = {
      [cabins.economy]: 'economy',
      [cabins.premium]: 'premiumeconomy',
      [cabins.business]: 'business',
      [cabins.first]: 'firstSuite'
    }
    if (!(cabin in classOptions)) {
      return { error: `Invalid cabin class: ${cabin}` }
    }
    if (!await this.select('#city1-cabin-1', classOptions[cabin])) {
      return { error: `Could not set cabin class to: ${cabin}` }
    }
  }

  async setQuantity (page, quantity) {
    if (!await this.select('#city1-cabin-2', quantity.toString())) {
      return { error: `Could not set # of adults to: ${quantity}` }
    }
  }

  async submit (page, htmlFile, screenshot) {
    let ret

    // Submit the form
    const response = await this.clickAndWait('#form-book-travel-1 #city-travel-input-2', this.config.waitUntil)
    await settle(this)

    // Save the HTML and screenshot
    ret = await this.save(htmlFile, screenshot)
    if (ret && ret.error) {
      return ret
    }

    // Check response code
    ret = this.validResponse(response)
    if (ret && ret.error) {
      return ret
    }
  }
}

async function settle (engine) {
  // Wait for spinner
  await engine.settle('div.overlay-loading')
}

async function airportCodes (engine) {
  const { page } = engine
  const airports = new Map()

  // Make sure we're in redeem flights mode (to see all the *A cities)
  await page.waitFor('#travel-radio-2', {visible: true})
  await page.click('#travel-radio-2')
  await settle(engine)

  // Wait for the selector to exist
  const selector = '#cib-flight3 > option'
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
      airports.set(code[1], name)
    }
  }

  return { airports }
}
