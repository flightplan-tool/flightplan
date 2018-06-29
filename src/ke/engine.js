const Engine = require('../base/engine')
const { cabins } = require('../consts')

module.exports = class extends Engine {
  async initialize (page) {
    this.prevQuery = {}

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

  async prepare (page) {}

  async isLoggedIn (page) {
    await Promise.race([
      page.waitFor('#skypassLoginButton', { visible: true }).catch(e => {}),
      page.waitFor('#skypassLogoutButton', { visible: true }).catch(e => {})
    ])
    return !!(await page.$('#skypassLogoutButton'))
  }

  async login (page) {
    const { username, password } = this.options
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

  validAirport (airport) {
    return this.airports.has(airport)
  }

  async reloadSearch (page) {
    this.useInlineForm = false
    const modifySearchSel = '#award-avenue > div.change-avail div.booking-ct-btn > button'

    // Check if we can reuse search results page from previous query
    if (canReuseQuery(this.prevQuery, this.query)) {
      if (await page.$(modifySearchSel)) {
        // Make sure we're not stuck on flexible dates calendar
        if (!await page.$('div.award-cal')) {
          // Open the in-line search form
          await page.click(modifySearchSel)
          await page.waitFor(500)
          this.useInlineForm = true
        }
      }
    }
    this.prevQuery = {} // Clear previous query

    return !this.useInlineForm
  }

  async setup (page) {
    if (!this.useInlineForm) {
      // Select "Award Booking"
      const awardSel = '#booking-type button[data-name="award"]'
      await page.waitFor(awardSel)
      await page.click(awardSel)

      // Select "Korean Air award" (not SkyTeam)
      await page.click('#sta-kr')
    }
  }

  async setFromCity (page, city) {
    await setCity(this, 'li.airports-departure-area input.fromto-input', city)
  }

  async setToCity (page, city) {
    await setCity(this, 'li.airports-arrival-area input.fromto-input', city)
  }

  async setOneWay (page, oneWay) {
    if (!this.useInlineForm) {
      await page.click(`#from-to-chooser input[value="${oneWay ? 'oneway' : 'roundtrip'}"]`)
    }
  }

  async setDepartDate (page, departDate) {
    const dateInputSel = 'div.dateholder input.tripdetail-input'
    await page.click(dateInputSel)
    await this.clear(dateInputSel)
    const dates = this.query.oneWay ? [departDate] : [departDate, this.query.returnDate]
    const strDates = dates.map(x => x.format('YYYY-MM-DD')).join('/')
    await page.keyboard.type(strDates, { delay: 10 })
    await page.keyboard.press('Tab')
  }

  async setReturnDate (page, returnDate) {
    // Nothing to do
  }

  async setCabin (page, cabin) {
    if (!this.useInlineForm) {
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
    }
  }

  async setQuantity (page, quantity) {
    if (!this.useInlineForm) {
      // Set the # of passengers
      // TODO: Account will need multiple family members registered to enable this
    }
  }

  async submit (page, htmlFile, screenshot) {
    let ret

    // Submit the search form
    const submitSel = this.useInlineForm
      ? '#award-avenue > div.change-avail div.booking-ct-btn > input[value="Search"'
      : '#submit'
    const [response] = await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }),
      submitForm(this, submitSel)
    ])
    await settle(this)

    // Any form submission errors?
    try {
      await page.waitFor('#booking-gate-from-to-chooser-error p.error', { visible: true, timeout: 500 })
      return { error: 'An error was detected in form submission' }
    } catch (e) {}

    // Insert a small wait
    await this.waitBetween([5, 10])

    // Save HTML and screenshot
    ret = await this.save(htmlFile, screenshot)
    if (ret && ret.error) {
      return ret
    }

    // Check response code
    ret = this.validResponse(response)
    if (ret && ret.error) {
      return ret
    }

    // Update previous query
    this.prevQuery = {...this.query}
  }
}

async function settle (engine) {
  const { page } = engine

  // While loading bar exists, keep waiting...
  while (true) {
    if (await engine.settle('div.loading-bar', 500, 2000)) {
      break
    }

    // If we hit a modal popup while results were loading, then return
    if (await page.$('#btnModalPopupYes')) {
      break
    }
  }
}

function canReuseQuery (prevQuery, query) {
  const fields = ['fromCity', 'toCity', 'cabin', 'quantity', 'oneWay']
  return !fields.find(x => query[x] !== prevQuery[x])
}

async function setCity (engine, selector, value) {
  const { page } = engine
  await page.click(selector)
  await engine.clear(selector)
  await page.keyboard.type(value, { delay: 10 })
  await page.waitFor(1000)
  await page.keyboard.press('Tab')
}

async function submitForm (engine, submitSel) {
  const { page } = engine

  // Hit submit first
  await page.click(submitSel)

  // Check for popups
  while (true) {
    // Check if we got a popup
    const dontShowAgainSel = '#popsession-checkbox'
    const confirmSel = '#cboxLoadedContent div.btn-area.tcenter > button'
    try {
      await page.waitFor(confirmSel, { visible: true, timeout: 5000 })
    } catch (e) {}

    // Check the box to not show again, then dismiss the popup
    try {
      if (await page.$(dontShowAgainSel)) {
        await page.click(dontShowAgainSel)
        await page.waitFor(1000)
      }
      if (await page.$(confirmSel)) {
        await page.click(confirmSel)
      } else {
        // No popup detected, break out
        break
      }
    } catch (e) {
      console.error(e)
    }
  }
}

async function airportCodes (engine) {
  const { page } = engine
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

  return { airports: codes }
}
