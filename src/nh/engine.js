const Engine = require('../base/engine')
const { cabins } = require('../consts')

module.exports = class extends Engine {
  async initialize (page) {
    // Load airport codes
    this.info('Loading airports...')
    const { airports, error } = await airportCodes(this, '#cib-flight3 > option')

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
      page.waitFor('li.btnLogoutArea', { visible: true }).catch(e => {}),
      page.waitFor('#accountNumber', { visible: true }).catch(e => {})
    ])

    const loggedIn = !!(await page.$('li.btnLogoutArea'))

    // If not fully logged in, log out (in case saved AMC number is different)
    if (loggedIn && await page.$('#password')) {
      await this.clickAndWait('li.btnLogoutArea > a')

      // Go back to flight search page
      await page.goto(this.config.searchURL, {waitUntil: 'networkidle0'})
      return false
    }

    return loggedIn
  }

  async login (page) {
    const { username, password } = this.options

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
    await settle(this)
  }

  validAirport (airport) {
    return this.airports.has(airport)
  }

  async prepare (page) {
    // Make sure form is ready
    await settle(this)

    // Make sure round-trip is selected (one-way not supported)
    const roundTripSel = '#roundTripOpenJawSelected\\3a openJaw01\\3a radioItem'
    await page.waitFor(roundTripSel, { visible: true })
    await page.click(roundTripSel)
    await settle(this)
  }

  async setFromCity (page, city) {
    await setCity(this, '#departureAirportCode\\3a field_pctext', city)
  }

  async setToCity (page, city) {
    await setCity(this, '#arrivalAirportCode\\3a field_pctext', city)
  }

  async setDepartDate (page, departDate) {
    await setDate(this, '#awardDepartureDate\\3a field_pctext', departDate)
  }

  async setReturnDate (page, returnDate) {
    await setDate(this, '#awardReturnDate\\3a field_pctext', returnDate)
  }

  async setCabin (page, cabin) {
    const cabinOptions = {
      [cabins.economy]: 'CFF1',
      [cabins.business]: 'CFF2',
      [cabins.first]: 'CFF3'
    }
    if (!(cabin in cabinOptions)) {
      return { error: `Invalid cabin class: ${cabin}` }
    }
    if (!await this.select('#boardingClass', cabinOptions[cabin])) {
      return { error: `Could not set cabin to: ${cabin}` }
    }
  }

  async setQuantity (page, quantity) {
    if (!await this.select('#adult\\3a count', quantity.toString())) {
      return { error: `Could not set # of adults to: ${quantity}` }
    }
  }

  async submit (page, htmlFile, screenshot) {
    let ret

    // Make sure travel dates are fixed
    if (await page.$('#comparisonSearchType:checked')) {
      await page.click('#comparisonSearchType')
      await settle(this)
    }

    // Submit the form
    const response = await this.clickAndWait('#itinerarySearch > div.areaSeparate > p.btnFloat > input')
    await settle(this)

    // Make sure we're looking at NH awards, not *A
    try {
      await page.waitFor('#selectAward01', { visible: true, timeout: 1000 })
      if (!await page.$('#selectAward01:checked')) {
        await page.click('#selectAward01')
      }
    } catch (e) {}

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
  // Wait a tiny bit, for things to run
  const { page } = engine
  await page.waitFor(250)
  await page.waitFor('div.loadingArea', { hidden: true })
  await page.waitFor(1000)
}

async function setCity (engine, selector, value) {
  const { page } = engine
  await page.click(selector)
  await engine.clear(selector)
  await page.keyboard.type(value, { delay: 10 })
  await page.waitFor(1000)
  await page.keyboard.press('Tab')
}

async function setDate (engine, selector, date) {
  const { page } = engine
  const strDate = date.format('YYYY-MM-DD')
  await page.click(selector)
  await page.waitFor(1000) // Wait for calendar to open up
  await page.click(`td[abbr="${strDate}"]`)
}

async function airportCodes (engine) {
  const { page } = engine
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

  return { airports: codes }
}
