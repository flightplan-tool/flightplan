const { DateTime } = require('luxon')

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

  async prepare (page) {}

  async isLoggedIn (page) {
    // Sometimes the page keeps reloading out from under us
    return this.retry(async () => {
      try {
        await page.waitFor('li.member-login-section, li.member-section', { visible: true })
      } catch (err) {}
      return !!(await page.$('li.member-section'))
    })
  }

  async login (page) {
    const { username, password } = this.options
    if (!username || !password) {
      return { error: `Missing login credentials` }
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
    if (!await page.$('#checkRememberMe:checked')) {
      await page.click('label[for=checkRememberMe]')
      await page.waitFor(250)
    }

    // Submit form
    await this.clickAndWait('#account-login div.form-login-wrapper button.btn-primary')
  }

  validAirport (airport) {
    return this.airports.has(airport)
  }

  async setup (page) {
    // Make sure destination city is cleared
    await clearCity(this, '#input-destination')
  }

  async setFromCity (page, city) {
    await setCity(this, '#input-origin', '#results-origin', city)
  }

  async setToCity (page, city) {
    await setCity(this, '#input-destination', '#results-destination', city)
  }

  async setOneWay (page, oneWay) {
    await page.click(oneWay ? '#tab-itinerary-type-oneway span' : '#tab-itinerary-type-return span')
    await page.waitFor(500)
  }

  async setDepartDate (page, departDate) {
    const dates = this.query.oneWay ? [departDate] : [departDate, this.query.returnDate]
    const selector = `div.travel-dates-${this.query.oneWay ? 'ow' : 'rt'}-wrapper button`

    // Open up the calendar
    await page.click(selector)

    // Select each date
    for (const date of dates) {
      await setDate(this, date)
    }
  }

  async setReturnDate (page, returnDate) {
    // Nothing to do
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
    if (!await this.select('#select-cabin', cabinOptions[cabin])) {
      return { error: `Could not set cabin to: ${cabin}` }
    }
  }

  async setQuantity (page, quantity) {
    await page.click('#btn-passengers')
    await page.waitFor('#select-adult', { visible: true })
    if (!await this.select('#select-adult', quantity.toString())) {
      return { error: `Could not set # of adults to: ${quantity}` }
    }
  }

  async submit (page, htmlFile, screenshot) {
    let ret

    // Turn off flexible dates
    if (await page.$('#flexible-dates:checked')) {
      await page.click('label[for=flexible-dates]')
      await page.waitFor(250)
    }

    // Submit search form
    const response = await Promise.race([
      this.clickAndWait('button.btn-facade-search'),
      this.page.waitFor('span.label-error', { visible: true, timeout: 0 })
    ])
    if (response && response.constructor.name !== 'ElementHandle') {
      ret = this.validResponse(response)
      if (ret && ret.error) {
        return ret
      }
    }

    // Check for error messages
    const msg = await this.textContent('span.label-error')
    if (msg.length > 0 && !msg.includes('no flights available')) {
      // If session becomes invalid, logout
      if (msg.includes('please login again')) {
        await logout(this)
      }
      return { error: msg }
    }

    // Save results for each award type (Standard / Choice / Tailored)
    while (true) {
      ret = await saveResults(this, htmlFile, screenshot)
      if (ret && ret.error) {
        return ret
      }

      // Find the next tab's selector
      const tabSel = await nextTab(this)
      if (!tabSel) {
        break
      }

      // Click on the tab
      await page.click(tabSel)

      // Dismiss modal pop-up, warning us about changing award type
      await dismissWarning(this)
    }
  }
}

async function logout (engine) {
  const { page } = engine

  // Logout if possible
  const memberSel = 'li.member-section'
  const logoutSel = `${memberSel} button.circle-link-arrow-btn`
  try {
    await page.waitFor(memberSel, { visible: true, timeout: 1000 })
    await page.hover(memberSel)
    await page.waitFor(logoutSel, { visible: true, timeout: 1000 })
    await engine.clickAndWait(logoutSel)
  } catch (err) {}
}

async function saveResults (engine, htmlFile, screenshot) {
  // If there's a "No flights available" modal pop-up, dismiss it
  await engine.clickIfVisible('#flights-not-available-modal button.btn-modal-close')

  // Make sure results have finished loading
  await settle(engine)

  // Insert a small wait (to simulate throttling between tabs)
  await engine.waitBetween([4, 6])

  // Save the HTML and screenshot
  const ret = await engine.save(htmlFile, screenshot)
  if (ret && ret.error) {
    return ret
  }
}

async function nextTab (engine) {
  const { page } = engine

  // Calculate the index of the next tab (in same cabin) after currently selected one
  const tabIndex = await page.evaluate((itemSel, activeSel) => {
    let idx = 1
    let foundActive = false
    const activeTab = document.querySelector(activeSel + ' span.cabin-class')
    if (activeTab) {
      const cabin = activeTab.textContent.trim()
      for (const item of document.querySelectorAll(itemSel)) {
        if (item.querySelector('span.cabin-class').textContent.trim() === cabin) {
          if (foundActive) {
            // This is the item after the active one
            return idx
          } else if (item.querySelector(activeSel)) {
            // This is the active item
            foundActive = true
          }
        }
        idx++
      }
    }
    return 0
  }, 'div.owl-item', 'div.cabin-ticket-card-wrapper-outer.active')
  return tabIndex ? `div.owl-item:nth-child(${tabIndex}) div.cabin-ticket-card` : null
}

async function dismissWarning (engine) {
  const { page } = engine

  // Warning modal present?
  try {
    await page.waitFor('#change-ticket-type-modal', { visible: true, timeout: 1000 })

    // Check the "Don't show again" box and dismiss
    if (await page.$('#change-ticket-type-dont-show-again:not(:checked)')) {
      await page.click('label[for=change-ticket-type-dont-show-again]')
      await page.waitFor(250)
    }
    await page.click('#change-ticket-type-modal button.btn-confirm')
  } catch (err) {}
}

async function settle (engine) {
  // Wait for spinner
  await engine.settle('.section-loading-overlay')
  await engine.settle('img.icon-loading')
}

async function setCity (engine, inputSel, selectSel, value) {
  const { page } = engine
  await page.click(inputSel)
  await engine.clear(inputSel)
  await page.waitFor(500)
  await page.keyboard.type(value, { delay: 100 })
  const itemSel = selectSel + ` li[data-airportcode=${value}]`
  await page.waitFor(itemSel, { visible: true, timeout: 10000 })
  await page.click(itemSel)
  await page.waitFor(500)
}

async function clearCity (engine, inputSel) {
  const { page } = engine
  try {
    await page.waitFor(inputSel, { visible: true })
    await page.click(inputSel)
    await page.waitFor(500)
    await page.keyboard.press('Backspace')
    await page.waitFor(500)
  } catch (err) {}
}

async function setDate (engine, date) {
  const { page } = engine
  let ret, direction

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
      btnSel = '.ui-datepicker-group-first .ui-datepicker-prev'
    } else if (date.isAfter(m2.endOf('month'))) {
      btnSel = '.ui-datepicker-group-last .ui-datepicker-next'
    }
    if (btnSel) {
      if (direction && btnSel !== direction) {
        return { error: `Infinite loop detected searching calendar for date: ${date}` }
      }
      ret = await changeMonth(page, btnSel, date)
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
  const month = DateTime.fromFormat(str, 'MMM yyyy')

  // Does the date belong to this month?
  if (!date.isSame(month, 'month')) {
    return { month, success: false }
  }

  // Find the right day, and click it
  for (const elem of await page.$$(selector + ' a')) {
    const text = await page.evaluate(x => x.textContent, elem)
    const elemDate = DateTime.fromFormat(text, 'EEEE MMMM d, yyyy')
    if (elemDate.isValid && elemDate.day === date.day) {
      // Found the date, click it!
      await elem.click()
      await page.waitFor(500)
      return { month, success: true }
    }
  }

  return { error: `Date link not found within selected month: ${date}` }
}

async function changeMonth (page, selector, date) {
  // Check if the desired link is not present
  if (!await page.$(selector)) {
    return { error: `Requested month is outside of bounds: ${date}` }
  }
  await page.click(selector)
  await page.waitFor(500)
  return {}
}

async function airportCodes (engine) {
  const { page } = engine
  const airports = new Set()

  // Make sure page is loaded
  const inputSel = '#input-origin'
  await page.waitFor(inputSel, { visible: true })

  // Make sure return city is cleared (or else it gets excluded from results)
  await clearCity(engine, '#input-destination')

  // Click to focus the input box for entering departure city
  await page.click(inputSel)
  await page.waitFor(100)

  // To populate the list, we just keep typing in letters (a-z)
  const selector = '#results-origin'
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(97 + i)
    await page.keyboard.type(letter)
    await page.waitFor(100)

    // Get the list of cities from the auto-complete list
    await page.waitFor(selector, { visible: true })
    const idList = await page.$$eval(selector + ' > li', items => (
      items.map(li => li.getAttribute('data-airportcode'))
    ))
    idList.forEach(x => airports.add(x))
    await engine.clear(inputSel)
  }

  return { airports }
}
