const { randomInt } = require('../shared/utils')

module.exports = (Base) => class extends Base {
  clear (selector) {
    return this.page.evaluate((selector) => {
      document.querySelector(selector).value = ''
    }, selector)
  }

  async clickAndWait (selector, waitUntil = 'networkidle0') {
    const [response] = await Promise.all([
      this.page.waitForNavigation({ waitUntil }),
      this.page.click(selector)
    ])
    return response
  }

  async clickIfVisible (selector, timeout = 250) {
    try {
      await this.page.waitFor(selector, { visible: true, timeout })
      await this.page.click(selector)
      return true
    } catch (e) {
      return false
    }
  }

  isBlocked (html) {
    return html.includes('<h1>Access Denied</h1>')
  }

  async retry (fn, attempts = 4, delay = 1000) {
    while (attempts > 0) {
      attempts--
      try {
        return await fn()
      } catch (e) {
        await this.page.waitFor(delay)
      }
    }
    throw new Error('Too many attempts failed')
  }

  async select (selector, value, wait = 250) {
    await this.page.select(selector, value)
    await this.page.waitFor(wait)
    return value === await this.page.$eval(selector, x => x.value)
  }

  async settle (selector, timeout1 = 1000, timeout2 = 300000) {
    while (true) {
      // Wait for the element to appear
      try {
        await this.page.waitFor(selector, { visible: true, timeout: timeout1 })
      } catch (e) {
        return true
      }

      // Wait for the element to disappear
      try {
        await this.page.waitFor(selector, { hidden: true, timeout: timeout2 })
      } catch (e) {
        return false
      }
    }
  }

  setValue (selector, value) {
    return this.page.evaluate((sel, val) => {
      document.querySelector(sel).value = val
    }, selector, value)
  }

  textContent (selector, defaultValue = '') {
    return this.page.evaluate((sel, defVal) => {
      const ele = document.querySelector(sel)
      return ele ? ele.textContent : defVal
    }, selector, defaultValue)
  }

  waitBetween (range) {
    const [min, max] = range
    return this.page.waitFor(randomInt(min * 1000, max * 1000))
  }
}
