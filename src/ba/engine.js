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

  async prepare (page) {
    // Check for region / language modal
    let ret = await setRegionLanguage(this, 'US', 'EN')
    if (ret && ret.error) {
      return ret
    }
  }

  async isLoggedIn (page) {
    // Sometimes the page keeps reloading out from under us
    return this.retry(async () => {
      try {
        await page.waitFor('#navLoginForm, li.memberName', { visible: true, timeout: 1000 })
      } catch (err) {}
      return !(await page.$('#navLoginForm'))
    })
  }

  async login (page) {
    const { username, password } = this.options
    if (!username || !password) {
      return { error: `Missing login credentials` }
    }

    // Enter username and password
    await this.clear('#navLoginForm #loginid')
    await page.click('#navLoginForm #loginid')
    await page.waitFor(1000)
    await page.keyboard.type(username, { delay: 10 })
    await this.clear('#navLoginForm #password')
    await page.click('#navLoginForm #password')
    await page.waitFor(1000)
    await page.keyboard.type(password, { delay: 10 })
    await page.waitFor(250)

    // Check remember box, and submit the form
    if (!await page.$('#navLoginForm #remcheck:checked')) {
      await page.click('#navLoginForm #remcheck')
      await page.waitFor(250)
    }
    await this.clickAndWait('#navLoginForm button[type="submit"]')
  }

  validAirport (airport) {
    return this.airports.has(airport)
  }

  async setup (page) {
    // Be sure we're on "Book with Avios" tab
    if (!this.isModifying()) {
      const selBookWithAvios = '#StandardRedemptionTab > span'
      await page.waitFor(selBookWithAvios, { visible: true })
      await page.click(selBookWithAvios)
    }

    // Give the page time to load
    page.waitFor(1000)
  }

  async setFromCity (page, city) {
    await this.setValue('#departurePoint', city)
  }

  async setToCity (page, city) {
    await this.setValue('#destinationPoint', city)
  }

  async setOneWay (page, oneWay) {
    if (await page.$(oneWay ? '#oneWay:not(:checked)' : '#oneWay:checked')) {
      await page.click('#oneWayLabel')
      await page.waitFor(500)
    }
  }

  async setDepartDate (page, departDate) {
    if (this.isModifying()) {
      if (!await chooseDateTab(this, '#Outbound', departDate)) {
        return { modified: false } // Desired date cannot be directly selected
      }
    } else {
      departDate = departDate.format('MM/DD/YY')
      await this.setValue('#departInputDate', departDate)
    }
  }

  async setReturnDate (page, returnDate) {
    if (this.isModifying()) {
      if (!await chooseDateTab(this, '#Inbound', returnDate)) {
        return { modified: false } // Desired date cannot be directly selected
      }
    } else {
      returnDate = returnDate.format('MM/DD/YY')
      await this.setValue('#returnInputDate', returnDate)
    }
  }

  async setCabin (page, cabin) {
    const classOptions = {
      [cabins.economy]: 'M',
      [cabins.premium]: 'W',
      [cabins.business]: 'C',
      [cabins.first]: 'F'
    }
    if (!(cabin in classOptions)) {
      return { error: `Invalid cabin class: ${cabin}` }
    }
    await page.waitFor(1000)
    if (!await this.select('#cabin', classOptions[cabin])) {
      return { error: `Could not set cabin class to: ${cabin}` }
    }
  }

  async setQuantity (page, quantity) {
    if (!await this.select('#ad', quantity.toString())) {
      return { error: `Could not set # of adults to: ${quantity}` }
    }
  }

  async submit (page, htmlFile, screenshot) {
    let ret
    let response

    // Submit the form
    if (!this.isModifying()) {
      response = await this.clickAndWait('#submitBtn')
      await settle(this)
    }

    // Save the HTML and screenshot
    ret = await this.save(htmlFile, screenshot)
    if (ret && ret.error) {
      return ret
    }

    // Check response code
    if (response) {
      ret = this.validResponse(response)
      if (ret && ret.error) {
        return ret
      }
    }
  }
}

async function settle (engine) {
  // Give the interstitial page a chance to load
  await engine.page.waitFor(5000)

  // Wait for spinner
  await engine.settle('#interstitial-spinner', 5000)

  // Wait some more, just in case
  await engine.page.waitFor(5000)
}

async function setRegionLanguage (engine, region, lang) {
  const { page } = engine
  const selModal = '.countryLangModal'

  try {
    if (await page.waitFor(selModal, { visible: true, timeout: 1000 })) {
      if (!await engine.select(selModal + ' #countrycode', region)) {
        return { error: `Could not set region: ${region}` }
      }
      if (!await engine.select(selModal + ' #languagecode', lang)) {
        return { error: `Could not set language: ${lang}` }
      }
      await page.click(selModal + ' button[type="submit"]')
      await page.waitFor(1000)
    }
  } catch (err) {}
}

async function chooseDateTab (engine, selector, newDate) {
  const { page } = engine

  // Make sure date tabs are present
  if (!await page.$(selector + ' li.active-tab')) {
    return false
  }

  // How many days (+ / -) from current day do we want?
  let oldDate = await page.$eval(selector + ' li.active-tab', e => e.getAttribute('data-date-value'))
  oldDate = moment.utc(parseInt(oldDate))
  const diff = newDate.clone().utcOffset(0, true).diff(oldDate, 'd')
  if (isNaN(diff) || Math.abs(diff) > 9) {
    return false
  } else if (diff === 0) {
    return true
  }

  // What is the text of the tab we want
  const newDateLabel = newDate.format('D MMM')

  let tries = 0
  while (true) {
    // Is the tab currently visible?
    for (const tab of await page.$$(selector + ' a.date-tabs')) {
      const datemonth = await tab.$eval('span.datemonth', e => e.innerText)
      if (datemonth === newDateLabel) {
        const response = await engine.clickAndWait(tab)
        if (response) {
          const ret = engine.validResponse(response)
          if (ret && ret.error) {
            return false
          }
        }
        await settle(engine)
        return true
      }
    }

    // Move to next or previous week?
    if (tries === 0) {
      const weekSel = selector + ((diff < 0) ? ' li.week-nav.prev a' : ' li.week-nav.next a')
      if (await page.$(weekSel)) {
        const response = await engine.clickAndWait(weekSel)
        if (response) {
          const ret = engine.validResponse(response)
          if (ret && ret.error) {
            return false
          }
        }
        await settle(engine)
        continue
      }
      tries++
    }
    return false
  }
}

async function airportCodes (engine) {
  const { page } = engine
  const { waitUntil } = engine.config
  const codes = new Set()
  const reAirportCode = /\(([A-Z]{3})\)/

  // Go to the route network page
  const networkURL = 'https://www.britishairways.com/en-us/information/flight-information/our-route-network'
  await page.goto(networkURL, { waitUntil })

  // Make sure page is ready to use
  let ret = await engine.prepare(page)
  if (ret && ret.error) {
    return ret
  }

  // Grab each city's airport code
  const idList = await page.$$eval('span.routesListCode', items => (
    items.map(x => x.textContent)
  ))
  for (const text of idList) {
    if (text) {
      const result = reAirportCode.exec(text)
      if (result) {
        codes.add(result[1])
      }
    }
  }

  return { airports: codes }
}
