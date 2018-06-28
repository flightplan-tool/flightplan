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
    // Sometimes the page keeps reloading out from under us
    let attempts = 0
    while (attempts < 4) {
      attempts++
      try {
        await Promise.race([
          page.waitFor('li.member-login-section', { visible: true }).catch(e => {}),
          page.waitFor('li.member-section', { visible: true }).catch(e => {})
        ])
        return !!(await page.$('li.member-section'))
      } catch (e) {
        await page.waitFor(3000)
      }
    }
    return false
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
    page.waitFor(1000)
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
    ret = await saveResults(this, 'button.btn-facade-search', htmlFile, screenshot)
    if (ret && ret.error) {
      return ret
    }

    // Move through each additional fare class
    while (true) {
      // Get the index of the tab after the currently active one
      const tabIndex = await page.evaluate((itemSel, activeSel) => {
        let idx = 1
        let foundActive = false
        const cabin = document.querySelector(activeSel + ' span.cabin-class').textContent.trim()
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
        return 0
      }, 'div.owl-item', 'div.cabin-ticket-card-wrapper-outer.active')
      if (tabIndex) {
        // Click the next tab
        const tabSel = `div.owl-item:nth-child(${tabIndex}) div.cabin-ticket-card`
        ret = await saveResults(this, tabSel, htmlFile, screenshot)
        continue
      }
      break
    }
  }
}

async function saveResults (engine, selector, htmlFile, screenshot) {
  let ret
  const { page } = engine

  // Click the button
  const response = await page.click(selector)
  await settle(engine)

  // Wait reasonable amount of time for tabs to load
  try {
    await page.waitFor('div.owl-item.active', { visible: true, timeout: 5000 })
  } catch (e) {}

  // Insert another small wait
  await engine.waitBetween([4, 6])

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
  const { page } = engine

  while (true) {
    // Wait for loading overlay to disappear
    await page.waitFor(1000)
    await page.waitFor('.section-loading-overlay', { hidden: true })

    // Wait for individual flights to load
    while (true) {
      try {
        await page.waitFor('img.icon-loading', { visible: true, timeout: 1000 })
        await page.waitFor(1000)
      } catch (e) {
        break
      }
    }
    await page.waitFor(500)

    // Check for "changing ticket type" modal popup
    try {
      await page.waitFor('#change-ticket-type-modal', { visible: true, timeout: 2000 })
      if (await page.$('#change-ticket-type-dont-show-again:not(:checked)')) {
        await page.click('label[for=change-ticket-type-dont-show-again]')
        await page.waitFor(250)
      }
      await page.click('#change-ticket-type-modal button.btn-confirm')
      continue
    } catch (e) {}

    // Check for "flights not available" modal popup
    try {
      await page.waitFor('#flights-not-available-modal', { visible: true, timeout: 2000 })
      await page.click('#flights-not-available-modal button.btn-close')
      continue
    } catch (e) {}

    // Loading is done, and no modal popups detected
    break
  }
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
  const month = moment(str, 'MMM YYYY')

  // Does the date belong to this month?
  if (!date.isSame(month, 'month')) {
    return { month, success: false }
  }

  // Find the right day, and click it
  for (const elem of await page.$$(selector + ' a')) {
    const text = await page.evaluate(x => x.textContent, elem)
    const elemDate = moment(text, 'dddd MMMM D, YYYY')
    if (elemDate.isValid() && elemDate.date() === date.date()) {
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

  // Click to focus the input box for entering departure city
  const inputSel = '#input-origin'
  await page.waitFor(inputSel, { visible: true })
  await page.click(inputSel)
  await page.waitFor(500)

  // To populate the list, we just keep typing in letters (a-z)
  const selector = '#results-origin'
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(97 + i)
    await page.keyboard.type(letter)
    await page.waitFor(selector, { visible: true })

    // Get the list of cities from the auto-complete list
    const idList = await page.$$eval(selector + ' > li', items => (
      items.map(li => li.getAttribute('data-airportcode'))
    ))
    idList.forEach(x => airports.add(x))
    await engine.clear(inputSel)
  }

  return { airports }
}
