const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const helpers = require('../helpers')
const logging = require('../logging')
const utils = require('../../shared/utils')

class Parser {
  constructor (parent) {
    this.parent = parent
    this.config = parent.config
  }

  _parse (request) {
    const {
      htmlFile,
      fileCount,
      fromCity,
      toCity,
      departDate,
      returnDate,
      quantity
    } = request

    // Iterate through each HTML file in the request
    let awards = []
    for (let index = 0; index < fileCount; index++) {
      let ret

      ret = this.loadFile(htmlFile, index)
      if (ret && ret.error) {
        return ret
      }

      // Load html into parser
      const $ = cheerio.load(ret.html)

      // Call implementation-specific parser
      ret = this.parse(request, $, ret.html, index)
      if (ret && ret.error) {
        return ret
      }
      awards.push(...ret.awards)
    }

    // Combine awards for the same flight
    const map = new Map()
    awards.forEach(award => {
      const key = [award.flight, award.quantity].join('|')
      let arr = map.get(key)
      if (!arr) {
        arr = []
        map.set(key, arr)
      }
      arr.push(award)
    })
    awards = [...map.values()].map(arr => {
      const fares = []
      const set = new Set()
      for (const award of arr) {
        for (const code of award.fares.split(' ')) {
          if (code !== '' && !set.has(code)) {
            set.add(code)
            fares.push(code)
          }
        }
      }
      arr[0].fares = fares.join(' ')
      return arr[0]
    })

    // If no awards were found for a segment, add a placeholder indicating so
    this.noAwardFound(request, awards, fromCity, toCity, departDate)
    this.noAwardFound(request, awards, toCity, fromCity, returnDate)

    // Fill in awards with common info
    awards.forEach(x => {
      if (x.engine === undefined) {
        x.engine = this.config.id
      }
      if (x.airline === undefined) {
        x.airline = this.config.id
      }
      if (x.quantity === undefined) {
        x.quantity = quantity
      }
    })

    return { awards }
  }

  loadFile (htmlFile, index) {
    // Update the filename based on index
    if (index > 0) {
      htmlFile = utils.appendPath(htmlFile, '-' + index)
    }

    // Does the file exist?
    if (!fs.existsSync(htmlFile)) {
      return { error: `Request is missing HTML file: ${htmlFile}` }
    }

    // Read file, and decompress if necessary
    let html = fs.readFileSync(htmlFile)
    if (path.extname(htmlFile) === '.gz') {
      html = zlib.gunzipSync(html)
    }

    // Check if it was blocked
    if (this.isBlocked(html)) {
      return { error: 'Search was blocked' }
    }

    return { html }
  }

  noAwardFound (request, awards, fromCity, toCity, date) {
    const { cabin } = request

    // If no date, nothing to check...
    if (!date) {
      return
    }

    // Check if any awards for this segment were found
    if (awards.find(x => (
      x.fromCity === fromCity &&
      x.toCity === toCity &&
      x.date === date
    ))) { return }

    // If awards is empty, add a placeholder indicating nothing was found
    awards.push({
      fromCity,
      toCity,
      date,
      cabin,
      fares: ''
    })
  }
}

module.exports = helpers(logging(Parser))
