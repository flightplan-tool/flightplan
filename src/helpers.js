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

  isBlocked (html) {
    return html.includes('<h1>Access Denied</h1>')
  }

  async select (selector, value, wait = 250) {
    await this.page.select(selector, value)
    await this.page.waitFor(wait)
    return value === await this.page.$eval(selector, x => x.value)
  }

  setValue (selector, value) {
    return this.page.evaluate((sel, val) => {
      document.querySelector(sel).value = val
    }, selector, value)
  }

  waitBetween (range) {
    const [min, max] = range
    return this.page.waitFor(randomInt(min * 1000, max * 1000))
  }
}
