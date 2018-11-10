const logging = require('./logging')
const utils = require('./utils')

class SearcherError extends Error {}

class Searcher {
  static get Error () {
    return SearcherError
  }

  constructor (engine) {
    this._engine = engine
  }

  validate (query) {}

  async search (page, query, results) {
    const msg = 'No `search` method found on the defined Searcher, did you forget to override it?'
    throw new Error(`${this.constructor.name}(...): ${msg}`)
  }

  async modify (page, diff, query, lastQuery, results) {}

  checkResponse (response) {
    // If no response, that's usually OK (data was likely pre-fetched)
    if (response) {
      // 304's (cached response) are OK too
      if (!response.ok() && response.status() !== 304) {
        // Trigger an immediate cool-down period
        const { throttling } = this._engine._state
        if (throttling) {
          const { checkpoint = null } = throttling
          if (checkpoint) {
            checkpoint.remaining = 0
          }
        }

        // Throw SearchError
        throw new SearcherError(`Received non-OK HTTP Status Code: ${response.status()} (${response.url()})`)
      }
    }
  }

  clear (selector) {
    const { page } = this._engine
    return page.evaluate((selector) => {
      document.querySelector(selector).value = ''
    }, selector)
  }

  async clickAndWait (selector, waitUntil = this._engine.config.waitUntil) {
    const { page } = this._engine
    const clickPromise = selector.constructor.name === 'ElementHandle'
      ? selector.click()
      : page.click(selector)
    const [response] = await Promise.all([
      page.waitForNavigation({ waitUntil }),
      clickPromise
    ])
    return response
  }

  async clickIfVisible (selector, timeout = 250) {
    const { page } = this._engine
    try {
      await page.waitFor(selector, { visible: true, timeout })
      await page.click(selector)
      return true
    } catch (err) {
      return false
    }
  }

  fillForm (values) {
    const { page } = this._engine
    return page.evaluate((values) => {
      for (var key in values) {
        if (values.hasOwnProperty(key)) {
          const arr = document.getElementsByName(key)
          if (arr.length === 0) {
            throw new Error(`Missing form element: ${key}`)
          }
          for (let i = 0; i < arr.length; i++) {
            const ele = arr[i]
            if (ele.tagName === 'SELECT') {
              const opt = document.createElement('option')
              opt.value = values[key]
              opt.innerHTML = values[key]
              ele.appendChild(opt)
            }
            if (ele.type === 'checkbox') {
              ele.checked = values[key]
            } else {
              ele.value = values[key]
            }
          }
        }
      }
    }, values)
  }

  async goto (url) {
    const { page, config } = this._engine
    const { waitUntil } = config
    try {
      const response = await page.goto(url, { waitUntil })
      this.checkResponse(response)
    } catch (err) {
      throw new SearcherError(`goto(${url}): ${err.message}`)
    }
  }

  async monitor (selector, timeout1 = 2000, timeout2 = 300000) {
    const { page } = this._engine
    while (true) {
      // Wait for the element to appear
      try {
        await page.waitFor(selector, { visible: true, timeout: timeout1 })
      } catch (err) {
        return
      }

      // Wait for the element to disappear
      try {
        await page.waitFor(selector, { hidden: true, timeout: timeout2 })
      } catch (err) {
        throw new SearcherError('Stuck waiting for element to settle')
      }
    }
  }

  async retry (fn, attempts = 4, delay = 1000) {
    const { page } = this._engine
    while (attempts > 0) {
      attempts--
      try {
        return await fn()
      } catch (err) {
        await page.waitFor(delay)
      }
    }
    throw new SearcherError('Too many attempts failed')
  }

  async select (selector, value, wait = 500) {
    const { page } = this._engine
    await page.select(selector, value)
    await page.waitFor(wait)
    return value === await page.$eval(selector, x => x.value)
  }

  setValue (selector, value) {
    const { page } = this._engine
    return page.evaluate((sel, val) => {
      document.querySelector(sel).value = val
    }, selector, value)
  }

  async submitForm (name, options) {
    const { page, config } = this._engine
    const {
      capture,
      waitUntil = config.waitUntil,
      timeout = this._engine._state.timeout
    } = options || {}
    let fn = null

    try {
      // Create initial array of promises that need to resolve
      const promises = [
        page.evaluate((name) => { document.forms[name].submit() }, name)
      ]
      if (waitUntil !== 'none') {
        promises.push(page.waitForNavigation({ waitUntil }))
      }

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
          page.on('response', fn)
        }))
      }

      // Now create a single promise out of all of them, and apply a timeout
      let timer
      const results = await Promise.race([
        Promise.all(promises),
        new Promise((resolve, reject) => {
          timer = setTimeout(() => {
            reject(new SearcherError(`submitForm() timed out after ${timeout} ms`))
          }, timeout)
        })
      ])
      clearTimeout(timer)

      // Check responses for errors
      for (const response of [results[1], ...Object.values(responses)]) {
        this.checkResponse(response)
      }

      // Return the responses
      return capture
        ? (Array.isArray(capture) ? responses : responses[capture])
        : results[1]
    } catch (err) {
      throw new SearcherError(err.message) // Handle timeout
    } finally {
      // Make sure to cleanup the event handler
      if (fn) {
        page.removeListener('response', fn)
      }
    }
  }

  textContent (selector, defaultValue = '') {
    const { page } = this._engine
    return page.evaluate((sel, defVal) => {
      const ele = document.querySelector(sel)
      if (ele) {
        const textVal = ele.textContent
        if (typeof textVal === 'string') {
          return textVal
        }
      }
      return defVal
    }, selector, defaultValue)
  }

  visible (selector) {
    const { page } = this._engine
    return page.evaluate((sel) => {
      const ele = document.querySelector(sel)
      if (ele) {
        const style = window.getComputedStyle(ele)
        return style && style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0'
      }
      return false
    }, selector)
  }

  waitBetween (min, max) {
    const { page } = this._engine
    return page.waitFor(max ? utils.randomInt(min, max) : min)
  }

  get id () {
    return this._engine.id
  }

  get config () {
    return this._engine.config
  }

  get browser () {
    return this._engine.browser
  }

  get page () {
    return this._engine.page
  }

  set page (newPage) {
    this._engine.page = newPage
  }
}

module.exports = logging(Searcher)
