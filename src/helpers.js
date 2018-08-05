const moment = require('moment')
const parse = require('parse-duration')

const { cabins } = require('./consts')
const { randomInt } = require('../shared/utils')

module.exports = (Base) => class extends Base {
  clear (selector) {
    return this.page.evaluate((selector) => {
      document.querySelector(selector).value = ''
    }, selector)
  }

  async clickAndWait (selector, waitUntil = this.config.waitUntil) {
    const clickPromise = selector.constructor.name === 'ElementHandle'
      ? selector.click()
      : this.page.click(selector)
    const [response] = await Promise.all([
      this.page.waitForNavigation({ waitUntil }),
      clickPromise
    ])
    return response
  }

  async clickIfVisible (selector, timeout = 250) {
    try {
      await this.page.waitFor(selector, { visible: true, timeout })
      await this.page.click(selector)
      return true
    } catch (err) {
      return false
    }
  }

  async retry (fn, attempts = 4, delay = 1000) {
    while (attempts > 0) {
      attempts--
      try {
        return await fn()
      } catch (err) {
        await this.page.waitFor(delay)
      }
    }
    throw new Error('Too many attempts failed')
  }

  async select (selector, value, wait = 500) {
    await this.page.select(selector, value)
    await this.page.waitFor(wait)
    return value === await this.page.$eval(selector, x => x.value)
  }

  async settle (selector, timeout1 = 1000, timeout2 = 300000) {
    while (true) {
      // Wait for the element to appear
      try {
        await this.page.waitFor(selector, { visible: true, timeout: timeout1 })
      } catch (err) { return }

      // Wait for the element to disappear
      try {
        await this.page.waitFor(selector, { hidden: true, timeout: timeout2 })
      } catch (err) {
        throw new Error('Stuck waiting for element to settle')
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

  fillForm (values) {
    return this.page.evaluate((values) => {
      for (var key in values) {
        if (values.hasOwnProperty(key)) {
          const ele = document.getElementsByName(key)[0]
          if (ele.tagName === 'SELECT') {
            const opt = document.createElement('option')
            opt.value = values[key]
            opt.innerHTML = values[key]
            ele.appendChild(opt)
          }
          ele.value = values[key]
        }
      }
    }, values)
  }

  async submitForm (name, options) {
    const {
      capture,
      waitUntil = this.config.waitUntil,
      timeout = this.options.timeout
    } = options
    let fn = null

    try {
      // Create initial array of promises that need to resolve
      const promises = [
        this.page.evaluate((name) => { document.forms[name].submit() }, name),
        this.page.waitForNavigation({ waitUntil })
      ]

      // If capturing responses, set up the event handler
      const responses = {}
      if (capture) {
        const urls = new Set(Array.isArray(capture) ? capture : [capture])
        promises.push(new Promise((resolve, reject) => {
          fn = (response) => {
            for (const url of urls) {
              if (response.url().includes(url)) {
                urls.delete(url)
                responses[url] = response
              }
              if (urls.size === 0) {
                resolve(responses)
              }
            }
          }
          this.page.on('response', fn)
        }))
      }

      // Now create a single promise out of all of them, and apply a timeout
      let timer
      const results = await Promise.race([
        Promise.all(promises),
        new Promise((resolve, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`submitForm() timed out after ${timeout} ms`))
          }, timeout)
        })
      ])
      clearTimeout(timer)

      // Collect responses to be returned
      const ret = { responses: capture
        ? (Array.isArray(capture) ? responses : responses[capture])
        : results[1]
      }

      // Validate responses
      const errors = [results[1], ...Object.values(responses)].map(x => this.validResponse(x))
      const error = errors.find(x => x && x.error)
      if (error) {
        ret.error = error
      }

      // Return what we got
      return ret
    } catch (err) {
      // Handle timeout
      return { error: err.message }
    } finally {
      // Make sure to cleanup the event handler
      if (fn) {
        this.page.removeListener('response', fn)
      }
    }
  }

  waitBetween (range) {
    const [min, max] = range
    return this.page.waitFor(randomInt(min * 1000, max * 1000))
  }

  parseDuration (duration) {
    return moment.duration(parse(duration))
  }

  bestCabin (segments) {
    const ord = [cabins.first, cabins.business, cabins.premium, cabins.economy]
    return ord[Math.min(...segments.map(x => ord.indexOf(x.cabin)))]
  }

  mixedCabin (segments) {
    return !segments.map(x => x.cabin).every((val, i, arr) => val === arr[0])
  }

  totalStops (segments) {
    return segments.map(x => x.stops).reduce((acc, val) => acc + val, 0)
  }

  partnerAward (engine, segments) {
    return !!segments.find(x => x.airline !== engine)
  }

  validAirlineCode (code) {
    return code ? !!/^[A-Z]{2}$/.exec(code) : false
  }

  validAirportCode (code) {
    return code ? !!/^[A-Z]{3}$/.exec(code) : false
  }
}
