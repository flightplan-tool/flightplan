const moment = require('moment-timezone')

const Searcher = require('../../Searcher')
const { cabins } = require('../../consts')

const { errors } = Searcher

module.exports = class extends Searcher {
  async isLoggedIn (page) {
    // Sometimes the page keeps reloading out from under us
    return this.retry(async () => {
      try {
        await page.waitFor('li.member-login-section, li.member-section', { visible: true })
      } catch (err) {}
      return !!(await page.$('li.member-section'))
    })
  }

  async login (page, credentials) {
    const [ username, password ] = credentials
    if (!username || !password) {
      throw new errors.MissingCredentials()
    }

    // Enter username and password
    await this.enterText('#account-login #username', username)
    await this.enterText('#account-login #password', password)
    await page.waitFor(250)

    // Check remember box
    if (!await page.$('#account-login #checkRememberMe:checked')) {
      await page.click('#account-login label[for=checkRememberMe]')
      await page.waitFor(250)
    }

    // Submit form
    await this.clickAndWait('#account-login button.btn-primary')

    // Check for errors
    let msgError = ''
    try {
      msgError = await this.textContent('div.global-error-wrap li')
    } catch (e) {
      console.log('Page interrupted')
    }
    if (msgError.includes('incorrect membership number or username')) {
      throw new errors.InvalidCredentials()
    } else if (msgError.includes('reactivate your account')) {
      throw new errors.BlockedAccount()
    }
    if (await page.$('#captcha-container')) {
      throw new errors.BotDetected()
    }
  }

  async search (page, query, results) {
    const { oneWay, fromCity, toCity, cabin, quantity } = query
    const departDate = query.departDateMoment()
    const returnDate = query.returnDateMoment()

    // Make sure destination city is cleared
    await this.clearCity('#input-destination')

    // Set from / to cities
    await this.setCity('[aria-label="Leaving from"]', '[id="react-autowhatever-segments[0].origin"]', fromCity)
    await this.setCity('[name="segments[0].destination"]', '[id="react-autowhatever-segments[0].destination"]', toCity)

    // Set one-way / roundtrip
    await page.click(oneWay ? '#tab-tripType-ow span' : '#tab-tripType-rt span')
    await page.waitFor(500)

    // Set dates
    const dates = oneWay ? [departDate] : [departDate, returnDate]

    //set departure date

    //open departure date picker
    await page.click('div[class*=\'search-form-travel-date\'] div[class*=\'hit-test\']')
    await page.waitFor(1000)
    await this.setDate(departDate)

    // Set the cabin
    const cabinOptions = {
      [cabins.economy]: 'Economy',
      [cabins.premium]: 'Premium Economy',
      [cabins.business]: 'Business',
      [cabins.first]: 'First'
    }

    await page.click('#cabinClass')
    const cabinOptionSelector = `//div[contains(@class,'menu-list')]//div[contains(@class,'option') and .='${cabinOptions[cabin]}']`
    await ((await page.$x(cabinOptionSelector))[0]).click()

    // Turn off flexible dates
    if (await page.$('[type=checkbox]:checked')) {
      await page.click('[type=checkbox]+label')
      await page.waitFor(250)
    }

    // Set quantity
    await page.click('#numAdult\\,numChild-value')
    await page.waitFor(500)
    await page.click('#numAdult')
    const quantityOptionSelector = `//div[contains(@class,'menu-list')]//div[contains(@class,'option') and .='${quantity}']`
    await ((await page.$x(quantityOptionSelector))[0]).click()
    await page.waitFor(500)
    await page.click('#numAdult\\,numChild-value')
    // Get results
    await this.submitForm(results)
  }

  async submitForm (results) {
    const { page } = this
    const pageBom = []
    const milesInfo = []
    const json = {}

    let fn = null
    try {
      // Capture AJAX responses with pricing info
      fn = (response) => {
        if (response.url().includes('milesInfo')) {
          const contentLength = parseInt(response.headers()['content-length'])
          if (contentLength > 0) {
            response.json().then(x => {
              milesInfo.push(x)
            })
          }
        }
      }
      this.page.on('response', fn)

      // Submit search form
      const response = await Promise.race([
        await page.click('div[class*=search] button[type=submit] span'),
        this.page.waitFor('span.label-error', { visible: true, timeout: 0 })
      ])
      if (response && response.constructor.name !== 'ElementHandle') {
        this.checkResponse(response)
      }

      // Get results for each tier
      let idx = 0
      let tabs = null
      while (true) {
        // Make sure results have finished loading
        await this.settle()

        // Insert a small wait (to simulate throttling between tabs)
        await this.waitBetween(4000, 6000)

        // If there's a "No flights available" modal pop-up, dismiss it
        await this.clickIfVisible('#flights-not-available-modal button.btn-modal-close')

        // Obtain flight data
        pageBom.push(await page.evaluate(() => window.pageBom))

        // Take a screenshot
        await results.screenshot(`results-${idx}`)

        // Get the selectors of every tab, if not already done
        if (!tabs) {
          tabs = await this.findTabs()
          if (!tabs) {
            throw new Searcher.Error(`Failed to locate tab selectors`)
          }
        }
        if (tabs.length === 0) {
          break // No more tabs
        }
        const nextTab = tabs.shift()
        idx++

        // Make sure the tab is visible, then click it
        await this.scrollTab(nextTab)
        await page.click(nextTab)

        // Dismiss modal pop-up, warning us about changing award type
        await this.dismissWarning()
      }
    } finally {
      if (fn) {
        this.page.removeListener('response', fn)
      }
    }

    // Obtain JSON data from browser
    const tiers = await page.evaluate(() => {
      const { tiersListInbound, tiersListOutbound } = window
      return { tiersListInbound, tiersListOutbound }
    })
    if (tiers.tiersListInbound) {
      json.tiersListInbound = tiers.tiersListInbound
    }
    if (tiers.tiersListOutbound) {
      json.tiersListOutbound = tiers.tiersListOutbound
    }
    json.pageBom = pageBom
    json.milesInfo = milesInfo.reduce((result, curr) => ({ ...result, ...curr.milesInfo }), {})

    // Save results
    await results.saveJSON('results', json)
  }

  async logout () {
    const { page } = this

    // Logout if possible
    const memberSel = 'li.member-section'
    const logoutSel = `${memberSel} button.circle-link-arrow-btn`
    try {
      await page.waitFor(memberSel, { visible: true, timeout: 1000 })
      await page.hover(memberSel)
      await page.waitFor(logoutSel, { visible: true, timeout: 1000 })
      await this.clickAndWait(logoutSel)
    } catch (err) {}
  }

  async findTabs () {
    const { page } = this

    const tabs = await page.evaluate((queryCabin) => {
      const types = [ 'standard', 'choice', 'tailored' ]
      const all = [...document.querySelectorAll('#flightlistDept div.owl-item')]
        .map((item, idx) => {
          // Is the tab active?
          const active = !!item.querySelector('div.cabin-ticket-card-wrapper-outer.active')

          // Get the award type
          const type = item.querySelector('span.ticket-type').textContent.trim().toLowerCase()

          // Add the tab
          const sel = `div.owl-item:nth-of-type(${idx + 1}) div.cabin-ticket-card`
          return { sel, active, type }
        })

      // We only need one tab of each award type
      return types
        .map(type => all.find(x => x.type === type))
        .filter(x => !!x && !x.active)
        .map(x => x.sel)
    })

    return tabs
  }

  async scrollTab (sel) {
    const { page } = this
    const tabIndex = parseInt(/nth-of-type\((\d+)\)/.exec(sel)[1])

    // Scroll back to first tab
    while (true) {
      try {
        await page.waitFor('div.owl-prev', { visible: true, timeout: 1000 })
        await page.click('div.owl-prev')
      } catch (err) {
        break
      }
    }

    // Scroll forward to desired tab
    for (let i = 0; i < tabIndex - 2; i++) {
      try {
        await page.waitFor('div.owl-next', { visible: true, timeout: 1000 })
        await page.click('div.owl-next')
      } catch (err) {
        break
      }
    }
  }

  async dismissWarning () {
    const { page } = this

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

  async settle () {
    // Wait for spinner
    await this.monitor('.section-loading-overlay')
    await this.monitor('img.icon-loading')
  }

  async setCity (inputSel, selectSel, value) {
    const { page } = this
    await page.click(inputSel)
    await this.clear(inputSel)
    await page.waitFor(500)
    await page.keyboard.type(value, { delay: 300 })
    const itemSel = `[data-suggestion-index="0"]`
    await page.waitFor(1500)
    await page.click(itemSel)
    await page.waitFor(500)
  }

  async clearCity (inputSel) {
    const { page } = this
    try {
      await page.waitFor(inputSel, { visible: true })
      await page.click(inputSel)
      await page.waitFor(500)
      await page.keyboard.press('Backspace')
      await page.waitFor(500)
    } catch (err) {}
  }

  async setDate (date) {
    const { page } = this
    const month = date.format('MMM YYYY')
    const day = date.format('D')
    const monthSelector = `//div[contains(@class,"CalendarMonth") and @data-visible="true"]//span[.="${month}"]`
    const daySelector = `${monthSelector}/following::td[.="${day}"][1]`

    // Move through the calendar page-by-page
    while (true) {
      // Check if the desired date is displayed
      if (await page.$x(monthSelector).length === 0){
        //go to next tab in calendar
        await page.click('.DayPickerNavigation_button_next')
        await page.waitFor(500)
        continue
        }
      //set date
      await (await page.$x(daySelector))[0].click()
      return
      }
  }

  async chooseDate (selector, date) {
    const { page } = this

    // Parse out the month first
    const str = await page.evaluate((sel) => {
      return document.querySelector(sel).textContent
    }, selector + ' .ui-datepicker-title')
    const month = moment.utc(str.replace(/\s+/, ' '), 'MMM YYYY', true)

    // Does the date belong to this month?
    if (date.month() !== month.month()) {
      return { month, success: false }
    }

    // Find the right day, and click it
    for (const elem of await page.$$(selector + ' a')) {
      const text = await page.evaluate(x => x.textContent, elem)
      const elemDate = moment.utc(text.replace(/\s+/, ' '), 'dddd MMMM D, YYYY', true)
      if (elemDate.isValid() && elemDate.date() === date.date()) {
        // Found the date, click it!
        await elem.click()
        await page.waitFor(500)
        return { month, success: true }
      }
    }

    throw new Searcher.Error(`Date link not found within selected month: ${date}`)
  }

  async changeMonth (selector, date) {
    const { page } = this

    // Check if the desired link is not present
    try {
      await page.waitFor(1000)
      await page.waitFor(selector, { visible: true, timeout: 5000 })
    } catch (err) {
      throw new Searcher.Error(`Failed to navigate calendar to date: ${date}`)
    }
    await page.click(selector)
    await page.waitFor(500)
  }
}
