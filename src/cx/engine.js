const moment = require('moment')

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

  async isLoggedIn (page) {
    await Promise.race([
      page.waitFor('#login-welcomemsg', { visible: true }).catch(e => {}),
      page.waitFor('#account-login div.form-login-wrapper button.btn-primary', { visible: true }).catch(e => {})
    ])
    return !!(await page.$('#login-welcomemsg'))
  }

  async login (page) {
    const { username, password } = this.options

    // Enter username and password
    await page.click('#memID')
    await this.clear('#memID')
    await page.keyboard.type(username, { delay: 10 })
    await page.click('#memPIN')
    await this.clear('#memPIN')
    await page.keyboard.type(password, { delay: 10 })
    await page.waitFor(250)

    // Check remember box
    if (!await page.$('#checkRememberMe:checked')) {
      await page.click('label[for=checkRememberMe]')
      await page.waitFor(250)
    }

    // Submit form, and give the landing page up to 15 seconds to load
    try {
      await Promise.all([
        page.waitForNavigation({waitUntil: 'networkidle0', timeout: 15000}),
        page.click('#account-login div.form-login-wrapper button.btn-primary')
      ])
    } catch (e) {}
  }

  validAirport (airport) {
    return this.airports.has(airport)
  }

  async prepare (page) {
    // Search by destination, not miles
    await page.waitFor('#byDest', { visible: true })
    await page.click('#byDest')

    // Make sure cities are loaded, before typing them in
    await airportCodes(this)
  }

  async setFromCity (page, city) {
    await setCity(this, '#byDest-city-from', city)
  }

  async setToCity (page, city) {
    await setCity(this, '#byDest-city-to', city)
  }

  async setOneWay (page, oneWay) {
    if (!await this.select('#byDest-trip-type', oneWay ? 'O' : 'R')) {
      return { error: `Could not set trip type to: ${oneWay ? 'One-Way' : 'Round-Trip'}` }
    }
  }

  async setDepartDate (page, departDate) {
    return await setDate(this, '#byDest-txtDateDepartTrigger > img', departDate)
  }

  async setReturnDate (page, returnDate) {
    return !await setDate(this, '#byDest-txtDateReturnTrigger > img', departDate)
  }

  async setCabin (page, cabin) {
    const cabinOptions = {
      [cabins.economy]: 'Y',
      [cabins.premium]: 'W',
      [cabins.business]: 'C',
      [cabins.first]: 'F'
    }
    if (!(cabin in cabinOptions)) {
      return { error: `Invalid cabin class: ${cabin}` }
    }
    if (!await this.select('#byDest-trip-class1', cabinOptions[cabin])) {
      return { error: `Could not set cabin to: ${cabin}` }
    }
  }

  async setQuantity (page, quantity) {
    if (!await this.select('#byDest-adult', quantity.toString())) {
      return { error: `Could not set # of adults to: ${quantity}` }
    }
  }

  async submit (page, htmlFile, screenshot) {
    let ret

    // Select fixed travel dates
    await page.click('#byDest-radio')
    await page.waitFor(500)

    // Save the main page results first
    ret = await saveTab(this, '#btnSearch', htmlFile, screenshot)
    if (ret && ret.error) {
      return ret
    }

    // Now save the results for tab "Priority Awards Tier 1"
    await page.waitFor('#PT1Tab > a', { visible: true })
    await page.waitFor(1000)
    ret = await saveTab(this, '#PT1Tab > a', htmlFile, screenshot)
    if (ret && ret.error) {
      return ret
    }

    // Finally, save the results for tab "Priority Awards Tier 2"
    await page.waitFor('#PT2Tab > a', { visible: true })
    await page.waitFor(1000)
    ret = await saveTab(this, '#PT2Tab > a', htmlFile, screenshot)
    if (ret && ret.error) {
      return ret
    }
  }
}

async function saveTab (engine, selector, htmlFile, screenshot) {
  let ret

  // Click the button
  const response = await engine.clickAndWait(selector)
  await settle(engine)

  // Insert a small wait
  await engine.waitBetween([3, 5])

  // Save the HTML and screenshot
  ret = await engine.save(htmlFile, screenshot)
  if (ret && ret.error) {
    return ret
  }

  // Check response code
  ret = engine.validResponse(response)
  if (ret && ret.error) {
    return ret
  }
}

async function settle (engine) {
  // Wait a tiny bit, for things to run
  const { page } = engine
  await page.waitFor(250)
  await page.waitFor('div.wait-message', { hidden: true })
  await page.waitFor(1000)
}

async function setCity (engine, selector, value) {
  const { page } = engine
  await page.click(selector)
  await engine.clear(selector)
  await page.keyboard.type(value, { delay: 500 })
  await page.waitFor(2000)
  await page.keyboard.press('Tab')
  await page.waitFor(1000)
}

async function setDate (engine, selector, date) {
  const { page } = engine
  let ret, direction

  // Open up the calendar
  await page.click(selector)

  // Move through the calendar page-by-page
  while (true) {
    // Check if the desired date is displayed
    ret = await chooseDate(page, '.ui-datepicker-group-first', date)
    if (ret.error || ret.success) {
      return ret
    }
    const m1 = ret.month
    ret = await chooseDate(page, '.ui-datepicker-group-last', date)
    if (ret.error || ret.success) {
      return ret
    }
    const m2 = ret.month

    // Should move left?
    let btnSel
    if (date.isBefore(m1)) {
      btnSel = '.ui-datepicker-prev'
    } else if (date.isAfter(m2.endOf('month'))) {
      btnSel = '.ui-datepicker-next'
    }
    if (btnSel) {
      if (direction && btnSel !== direction) {
        return { error: `Infinite loop detected searching calendar for date: ${date}` }
      }
      ret = await changeMonth(page, btnSel)
      if (ret && ret.error) {
        return ret
      }
      direction = btnSel
    } else {
      return { error: `Did not find date on active calendar pages: ${date}` }
    }
  }
}

async function chooseDate (page, selector, date) {
  // Parse out the month first
  const str = await page.evaluate((sel) => {
    return document.querySelector(sel).textContent
  }, selector + ' .ui-datepicker-title')
  const month = moment(str, 'MMM YYYY')

  // Does the date belong to this month?
  if (!date.isSame(month, 'month')) {
    return { month, success: false }
  }

  // Find the right day, and click it
  strDay = date.date().toString()
  for (const elem of await page.$$(selector + ' a')) {
    const text = await page.evaluate(x => x.textContent, elem)
    if (text === strDay) {
      // Found the date, click it!
      await elem.click()
      await page.waitFor(500)
      return { month, success: true }
    }
  }

  return { error: `Date link not found within selected month: ${date}`}
}

async function changeMonth (page, selector) {
  // Check if the desired link is disabled
  if (await page.$(selector + '.ui-state-disabled')) {
    return { error: `Requested month is outside of bounds: ${date}`}
  }
  await page.click(selector)
  await page.waitFor(500)
  return {}
}

async function airportCodes (engine) {
  const { page } = engine
  const selector = '#as_byDest-city-from > ul'
  await page.waitFor(1000)

  // We first need to click on the list, so it gets populated. However, it sometimes
  // disappears unexpectedly, so keep trying until we clicked it successfully.
  const airports = new Set()
  let attempts = 0
  while (true) {
    if (attempts > 10) {
      return { error: 'Failed to load city list successfully' }
    }
    attempts++

    // Wait for button to be visible, then try to click it
    const btnSel = '#byDest-city-from-alink'
    await page.waitFor(btnSel, { visible: true })
    await page.click(btnSel)

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
      airports.add(match[1])
    }
  })

  return { airports }
}
