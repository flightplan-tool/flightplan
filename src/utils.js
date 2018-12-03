const address = require('address')
const externalIPLib = require('external-ip')
const moment = require('moment-timezone')
const path = require('path')
const timetable = require('timetable-fns')
const url = require('url')

const data = require('./data')

const reAirline = /^[A-Z0-9]{2}$/
const reFlightNo = /^[A-Z0-9]{2}\d{1,4}$/
const reAirport = /^[A-Z0-9]{3}$/
const reCurrency = /((?=.*?\d)^(([1-9]\d{0,2}(,\d{3})*)|\d+)?(\.\d{1,2})?)\s+([A-Z]{3})$/

const timezones = new Map()

function airportTimezone (strAirport) {
  let tz = timezones.get(strAirport)
  if (!tz) {
    tz = 'UTC' // Default to UTC
    const airport = data.airports[strAirport]
    if (airport) {
      const { timezone, offset } = airport
      if (timezone && moment.tz.zone(timezone)) {
        tz = timezone // Timezone is known and valid
      } else if (Number.isInteger(offset)) {
        if (offset !== 0) {
          tz = (offset > 0) ? `Etc/GMT-${offset}` : `Etc/GMT+${-offset}`
        }
      }
    }

    // Cache the timezone for future use
    timezones.set(strAirport, tz)
  }
  return tz
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

function closestYear (unknownDate, referenceDate) {
  // Convert to moment objects
  unknownDate = moment.isMoment(unknownDate) ? unknownDate : moment.utc(unknownDate)
  referenceDate = moment.isMoment(referenceDate) ? referenceDate : moment.utc(referenceDate)

  // Set the year of unknownDate that places it closest to referenceDate
  const year = referenceDate.year()
  const years = [ year - 1, year, year + 1 ]
  const arr = years.map(x => unknownDate.clone().set({ year: x }))
  const diffs = arr.map(x => Math.abs(referenceDate.diff(x, 'days')))

  // Choose the year that had the smallest absolute difference in days
  return arr[diffs.indexOf(Math.min(...diffs))]
}

function dateTimeTz (date, time, timezone) {
  return moment.tz(`${date} ${time}`, 'YYYY-MM-DD HH:mm', true, timezone)
}

function daysBetween (start, end) {
  return timetable.diff(timetable.coerce(start), timetable.coerce(end))
}

function duration (start, end) {
  return end.diff(start, 'minutes')
}

function durationRange (range) {
  range = Array.isArray(range) ? range : [ range ]
  range = range.map(x => parseDurationISO8601(x))
  if (range.includes(NaN)) {
    throw new Error(`Unparsable duration range: ${ppJSON(range)}`)
  }
  const val = (range.length > 1) ? randomInt(...range) : range[0]
  return moment.duration(val)
}

function now () {
  return moment()
}

function parseDurationISO8601 (text) {
  const arr = text.split(':')
  if (arr.length <= 0 || arr.length > 4) {
    return NaN
  }
  const mult = [ 24, 60, 60, 1000 ]
  const secs = arr.pop()
  if (secs.includes('.')) {
    mult.push(1)
    const subarr = secs.split('.')
    if (subarr.length !== 2) {
      return NaN
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
      return NaN
    }
    val += num * base
  }
  return val
}

function positiveInteger (val) {
  return typeof val === 'number' && val > 0 && val % 1 === 0
}

function randomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
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

function truthy (val) {
  const truthyValues = { 'true': 1, '1': 1, 'yes': 1, 'y': 1 }
  return val && val.toString().toLowerCase() in truthyValues
}

function validAirlineCode (str) {
  return (str && typeof str === 'string') ? reAirline.exec(str) : false
}

function validAirportCode (str) {
  return (str && typeof str === 'string') ? reAirport.exec(str) : false
}

function validCurrency (str) {
  return (str && typeof str === 'string') ? reCurrency.exec(str) : false
}

function validDate (str) {
  return timetable.valid(str)
}

function validFlightDesignator (str) {
  return (str && typeof str === 'string') ? reFlightNo.exec(str) : false
}

function validTime (str) {
  return timetable.validTime(str)
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

function localIP () {
  return address.ip()
}

function externalIP () {
  return new Promise((resolve, reject) => {
    externalIPLib()((err, ip) => (err ? reject(err) : resolve(ip)))
  })
}

module.exports = {
  airportTimezone,
  appendPath,
  closestYear,
  dateTimeTz,
  daysBetween,
  duration,
  durationRange,
  now,
  parseDurationISO8601,
  positiveInteger,
  randomInt,
  ppJSON,
  truthy,
  validAirlineCode,
  validAirportCode,
  validCurrency,
  validDate,
  validFlightDesignator,
  validTime,
  validURL,
  localIP,
  externalIP
}
