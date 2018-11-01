const { DateTime, Duration, Interval } = require('luxon')
const path = require('path')
const url = require('url')

const data = require('./data')

const reAirline = /^[A-Z0-9]{2}$/
const reFlightNo = /^[A-Z0-9]{2}\d{1,4}$/
const reAirport = /^[A-Z0-9]{3}$/
const reCurrency = /((?=.*?\d)^(([1-9]\d{0,2}(,\d{3})*)|\d+)?(\.\d{1,2})?)\s+([A-Z]{3})$/
const reTime = /^\d\d:\d\d$/

function validAirlineCode (str) {
  return (str && typeof str === 'string') ? reAirline.exec(str) : false
}

function validFlightDesignator (str) {
  return (str && typeof str === 'string') ? reFlightNo.exec(str) : false
}

function validAirportCode (str) {
  return (str && typeof str === 'string') ? reAirport.exec(str) : false
}

function validCurrency (str) {
  return (str && typeof str === 'string') ? reCurrency.exec(str) : false
}

function validURL (str) {
  let failed = false
  let result = null
  try {
    result = new url.URL(str)
  } catch (err) {
    failed = true
  }
  return !failed && result
}

function validTime (str) {
  return (str && typeof str === 'string') ? reTime.exec(str) : false
}

function parseTime (str, zone = 'utc') {
  return DateTime.fromFormat(str, 'HH:mm', { zone })
}

function validDate (str) {
  return (str && typeof str === 'string') ? parseDate(str).isValid : false
}

function parseDate (str, zone = 'utc') {
  return DateTime.fromISO(str, { zone }).startOf('day')
}

function joinDateTime (date, time) {
  const { hour, minute } = time
  return date.set({ hour, minute, second: 0 })
}

function duration (start, end) {
  const interval = Interval.fromDateTimes(start, end)
  if (!interval.isValid) {
    return -1
  }
  const val = interval.toDuration().as('minutes')
  return (val >= 0) ? val : -1
}

function days (start, end) {
  start = start.setZone('utc', { keepLocalTime: true })
  end = end.setZone('utc', { keepLocalTime: true })
  return end.startOf('day').diff(start.startOf('day'), 'days').days
}

function setNearestYear (referenceDate, unknownDate) {
  // Set the year of unknownDate that places it closest to referenceDate
  const year = referenceDate.year

  const years = [ year - 1, year, year + 1 ]
  const diffs = years.map(x => Math.abs(unknownDate.set({ year: x }).diff(referenceDate, 'days').days))

  // Choose the year that had the smallest absolute difference in days
  const bestYear = years[diffs.indexOf(Math.min(...diffs))]
  return unknownDate.set({ year: bestYear })
}

function positiveInteger (val) {
  return typeof val === 'number' && val > 0 && val % 1 === 0
}

function airportTimeZone (iataCode) {
  const airport = data.airports[iataCode]
  if (airport) {
    const { timezone, offset } = airport
    if (timezone && DateTime.utc().setZone(timezone).isValid) {
      return timezone
    }
    if (Number.isInteger(offset)) {
      const fixed = (offset >= 0) ? `UTC+${offset}` : `UTC${offset}`
      if (DateTime.utc().setZone(fixed).isValid) {
        return fixed
      }
    }
  }
  return 'utc'
}

function parseDurationISO8601 (text) {
  const arr = text.split(':')
  if (arr.length <= 0 || arr.length > 4) {
    return Duration.invalid('unparsable')
  }
  const mult = [ 24, 60, 60, 1000 ]
  const secs = arr.pop()
  if (secs.includes('.')) {
    mult.push(1)
    const subarr = secs.split('.')
    if (subarr.length !== 2) {
      return Duration.invalid('unparsable')
    }
    arr.push(...subarr)
  } else {
    arr.push(secs)
  }
  let val = 0
  let base = 1
  while (arr.length > 0) {
    base *= mult.pop()
    const num = parseInt(arr.pop())
    if (Number.isNaN(num) || (mult.length > 0 && num >= mult[mult.length - 1])) {
      return Duration.invalid('unparsable')
    }
    val += num * base
  }
  return Duration.fromMillis(val)
}

function randomDuration (range) {
  const [min, max] = Array.isArray(range) ? range : [range, range]
  return Duration.fromMillis(randomInt(...[min, max].map(x => parseDurationISO8601(x).valueOf())))
}

function randomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function truthy (val) {
  const truthyValues = { 'true': 1, '1': 1, 'yes': 1, 'y': 1 }
  return val && val.toString().toLowerCase() in truthyValues
}

function appendPath (strPath, str) {
  if (!strPath) {
    return strPath
  }
  const { dir, base } = path.parse(strPath)
  let pos = base.indexOf('.')
  if (pos < 0) {
    pos = base.length
  }
  return path.join(dir, base.slice(0, pos) + str + base.slice(pos))
}

function snapshot (obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  return Object.keys(obj).reduce((output, key) => {
    output[key] = snapshot(obj[key])
    return output
  }, {})
}

function ppJSON (obj) {
  const str = JSON.stringify(obj)
  if (str.length <= 160) {
    // Check if the whole string can fit on one line
    const shortened = str.replace(/\n\s?/g, ' ')
    if (shortened.length <= 80) {
      return shortened
    }
  }
  return str
}

module.exports = {
  validAirlineCode,
  validFlightDesignator,
  validAirportCode,
  validCurrency,
  validURL,
  validTime,
  parseTime,
  validDate,
  parseDate,
  joinDateTime,
  duration,
  days,
  setNearestYear,
  positiveInteger,
  airportTimeZone,
  parseDurationISO8601,
  randomDuration,
  randomInt,
  truthy,
  appendPath,
  snapshot,
  ppJSON
}
