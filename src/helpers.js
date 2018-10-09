const { DateTime, Duration, Interval } = require('luxon')
const parse = require('parse-duration')
const util = require('util')

const { cabins } = require('./consts')
const { airports } = require('./data')
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

  async monitor (selector, timeout1 = 2000, timeout2 = 300000) {
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

  async submitForm (name, options) {
    const {
      capture,
      waitUntil = this.config.waitUntil,
      timeout = this.options.timeout
    } = options || {}
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
    return Duration.fromMillis(parse(duration)).as('minutes')
  }

  bestCabin (segments) {
    const ord = [cabins.first, cabins.business, cabins.premium, cabins.economy]
    return ord[Math.min(...segments.map(x => ord.indexOf(x.cabin)))]
  }

  mixedCabin (segments) {
    return !segments.map(x => x.cabin).every((val, i, arr) => val === arr[0])
  }

  duration (first, last = first) {
    const start = this.departureDateTime(first)
    const end = this.arrivalDateTime(last)
    const interval = Interval.fromDateTimes(start, end)
    if (!interval.isValid) {
      throw new Error(`Invalid duration interval from segment: ${util.inspect(first)}, ${util.inspect(last)}`)
    }
    return interval.toDuration().as('minutes')
  }

  nextConnection (segment, segments) {
    const idx = segments.indexOf(segment)
    if (idx === segments.length - 1) {
      return null
    }
    const next = segments[idx + 1]
    const start = this.arrivalDateTime(segment)
    const end = this.departureDateTime(next)
    const interval = Interval.fromDateTimes(start, end)
    if (!interval.isValid) {
      throw new Error(`Invalid connection time interval from segments: ${util.inspect(segment)}, ${util.inspect(next)}`)
    }
    return interval.toDuration().as('minutes')
  }

  travelTime (segments) {
    return segments.map(x => x.duration).reduce((acc, val) => (acc + val), 0)
  }

  totalStops (segments) {
    return (segments.length - 1) + segments.map(x => x.stops).reduce((acc, val) => acc + val, 0)
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

  validDate (date) {
    return DateTime.fromFormat(date, 'yyyy-MM-dd', {zone: 'utc'}).isValid
  }

  validTime (time) {
    return DateTime.fromFormat(time, 'HH:mm', {zone: 'utc'}).isValid
  }

  airportTimeZone (iataCode) {
    const airport = airports[iataCode]
    if (airport) {
      const { timezone, offset } = airport
      if (timezone && DateTime.local().setZone(timezone).isValid) {
        return timezone
      }
      if (Number.isInteger(offset)) {
        const fixed = (offset >= 0) ? `UTC+${offset}` : `UTC${offset}`
        if (DateTime.local().setZone(fixed).isValid) {
          return fixed
        }
      }
    }
    return 'utc'
  }

  departureDateTime (segment) {
    // Create a timestamp, in the time zone of the departure airport
    return DateTime.fromFormat(
      `${segment.date} ${segment.departure}`,
      'yyyy-MM-dd HH:mm',
      { zone: this.airportTimeZone(segment.fromCity) }
    )
  }

  arrivalDateTime (segment) {
    // Create a timestamp, in the time zone of the arrival airport
    const dt = DateTime.fromFormat(
      `${segment.date} ${segment.arrival}`,
      'yyyy-MM-dd HH:mm',
      { zone: this.airportTimeZone(segment.toCity) }
    )
    return dt.plus({ days: segment.lagDays })
  }

  parseDate (text, fmt, options = {}) {
    // Parse the date using the provided format string
    const dt = DateTime.fromFormat(text, fmt, { ...options, zone: 'utc' })

    // Determine the year that puts the date closest to what we queried (due to
    // time zone changes, the arrival year could be earlier than the departure year)
    const queryDate = DateTime.fromSQL(this.query.departDate, { zone: 'utc' })
    const years = [queryDate.year - 1, queryDate.year, queryDate.year + 1]
    const diffs = years.map(x => Math.abs(queryDate.set({ year: x }).diff(queryDate).as('days')))

    // Choose the year that had the smallest absolute difference in days
    const bestYear = years[diffs.indexOf(Math.min(...diffs))]

    return dt.set({ year: bestYear })
  }

  computeLagDays (departure, arrival) {
    departure = DateTime.fromSQL(departure.toSQLDate(), { zone: 'utc' })
    arrival = DateTime.fromSQL(arrival.toSQLDate(), { zone: 'utc' })
    return arrival.diff(departure).as('days')
  }

  fares (cabin, saver = true, waitlisted = false) {
    return this.config.fares.find(x => {
      return x.cabin === cabin && x.saver === saver
    }).code + (waitlisted ? '@' : '+')
  }
}
