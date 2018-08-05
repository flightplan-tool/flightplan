const Engine = require('../base/engine')
const { cabins } = require('../consts')

module.exports = class extends Engine {
  async initialize (page) {}

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

  async setup (page, query) {
    // Check if we're modifying existing form
    if (this.isModifying()) {
      // Check if only changing dates, and directly selectable
      this.usingDateTabs = false
      if (!('fromCity' in query || 'toCity' in query)) {
        // Get old and new dates
        const { departDate, returnDate } = this.query
        const { departDate: oldDepartDate, returnDate: oldReturnDate } = this.prevQuery

        // Attempt to choose the dates directly
        if (await chooseDateTab(this, 'ul.date-outbound-column', oldDepartDate, departDate)) {
          if (!returnDate || await chooseDateTab(this, 'ul.date-inbound-column', oldReturnDate, returnDate)) {
            this.usingDateTabs = true
            return
          }
        }
      }

      // Couldn't select dates directly, open the inline form
      const modifySearchSel = `${this.query.partners ? '#inter-avenue' : '#award-avenue'} > div.change-avail div.booking-ct-btn > button`
      if (await page.$(modifySearchSel)) {
        // Make sure we're not stuck on flexible dates calendar
        if (!await page.$('div.award-cal')) {
          // Click to open the inline search form
          await page.click(modifySearchSel)
          await page.waitFor(500)
          return
        }
      }

      // Couldn't open the inline form
      return { modified: false }
    }

    // Select "Award Booking"
    const awardSel = '#booking-type button[data-name="award"]'
    await page.waitFor(awardSel)
    await page.click(awardSel)

    // Select "SkyTeam" or "Korean Air" award type based on whether we're searching partners
    await page.click(this.query.partners ? '#sta-sk' : '#sta-kr')
  }

  async setFromCity (page, city) {
    await setCity(this, 'li.airports-departure-area input.fromto-input', city)
  }

  async setToCity (page, city) {
    await setCity(this, 'li.airports-arrival-area input.fromto-input', city)
  }

  async setOneWay (page, oneWay) {
    await page.click(`#from-to-chooser input[value="${oneWay ? 'oneway' : 'roundtrip'}"]`)
  }

  async setDepartDate (page, departDate) {
    // If we already selected the new dates from tabs, nothing to do
    if (this.isModifying() && this.usingDateTabs) {
      return
    }

    // Fill out the normal date selector
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

  async setQuantity (page, quantity) {
    // Set the # of passengers
    // TODO: Account will need multiple family members registered to enable this
  }

  async submit (page, htmlFile, screenshot) {
    let ret

    // Don't submit if we used the date tabs to modify search
    if (this.isModifying() && this.usingDateTabs) {
      return
    }

    // Submit the search form
    const { partners } = this.query
    const submitSel = this.isModifying()
      ? `${partners ? '#inter-avenue' : '#award-avenue'} > div.change-avail > div > div.booking-ct-btn > input`
      : '#submit'
    const [response] = await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }),
      clickSubmit(this, submitSel)
    ])
    await settle(this)

    // Any form submission errors?
    try {
      await page.waitFor('#booking-gate-from-to-chooser-error p.error', { visible: true, timeout: 500 })
      return { error: 'An error was detected in form submission' }
    } catch (err) {}

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

async function setCity (engine, selector, value) {
  const { page } = engine
  await page.click(selector)
  await engine.clear(selector)
  await page.keyboard.type(value, { delay: 10 })
  await page.waitFor(1000)
  await page.keyboard.press('Tab')
}

async function chooseDateTab (engine, selector, oldDate, newDate) {
  const { page } = engine

  const tabs = await page.$(selector)
  if (!tabs) {
    return false
  }

  // Find the index of the selected tab
  const [ selIndex, selDate ] = await tabs.$eval('li.selected-date a', item => {
    return [ item.getAttribute('data-index'), item.getAttribute('data-name') ]
  })
  if (selDate !== oldDate.format('MM/DD')) {
    return false // Something's not right...
  }

  // Now we can locate the right tab
  let tabData = await tabs.$$eval('li.include-btn a', items => {
    items.map(x => [ x.getAttribute('data-index'), x.getAttribute('data-name') ])
  })
  const newSel = tabData.find(([ tabIndex, tabDate ]) => {
    const m = oldDate.clone().add(tabIndex - selIndex, 'd')
    return m.isSame(newDate, 'd') && m.format('MM/DD') === tabDate
  })
  if (!newSel) {
    return false
  }

  // Click the tab
  await tabs.click(`li.selected-date a[data-index="${newSel[0]}"]`)
  return true
}

async function clickSubmit (engine, submitSel) {
  const { page } = engine

  // Hit submit first
  await page.click(submitSel)

  // Check for popups
  while (true) {
    const confirm1 = '#cboxLoadedContent #btnModalPopupYes'
    const dontShowAgain1 = '#airpmessage-checkbox'
    const confirm2 = '#cboxLoadedContent div.btn-area.tcenter > button'
    const dontShowAgain2 = '#popsession-checkbox'

    try {
      await Promise.race([
        page.waitFor(confirm1, { visible: true, timeout: 5000 }),
        page.waitFor(confirm2, { visible: true, timeout: 5000 })
      ])
    } catch (err) {
      break
    }

    await dismissPopup(engine, dontShowAgain1, confirm1)
    await dismissPopup(engine, dontShowAgain2, confirm2)
  }
}

async function dismissPopup (engine, dontShowAgainSel, confirmSel) {
  const { page } = engine

  try {
    if (await page.$(confirmSel)) {
      // Check the box to not show again, then dismiss the popup
      if (await page.$(dontShowAgainSel)) {
        await page.click(dontShowAgainSel)
        await page.waitFor(500)
      }
      await page.click(confirmSel)
      await page.waitFor(1000)
    }
  } catch (err) {
    // Spurious context errors arise here sometimes, just try again...
    console.error(err)
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
