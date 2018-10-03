const fs = require('fs')
const { DateTime, Duration } = require('luxon')
const path = require('path')
const prompt = require('syncprompt')
const zlib = require('zlib')

const db = require('./db')

function addPlaceholders (results, options = {}) {
  const { query, awards } = results
  const { engine, fromCity, toCity, departDate, returnDate, quantity } = query

  // Helper function to add a placeholder
  const fn = (fromCity, toCity, date, cabin) => {
    if (date) {
      awards.push({
        engine,
        fromCity,
        toCity,
        date,
        cabin,
        quantity,
        mixed: false,
        partner: false,
        stops: 0,
        fares: ''
      })
    }
  }

  // Add award placeholders, so we know what routes were searched
  const { cabins = [query.cabin] } = options
  for (const cabin of cabins) {
    fn(fromCity, toCity, departDate, cabin)
    fn(toCity, fromCity, returnDate, cabin)
  }
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

function assetsForRequest (request) {
  const {
    html = [],
    json = [],
    screenshots = []
  } = JSON.parse(request.assets)
  return [...html, ...json, ...screenshots].map(x => x.path)
}

function changeExtension (strPath, ext) {
  if (!strPath) {
    return strPath
  }
  const { dir, base } = path.parse(strPath)
  if (!ext.startsWith('.')) {
    ext = '.' + ext
  }
  let pos = base.indexOf('.')
  if (pos < 0) {
    pos = base.length
  }
  return path.join(dir, base.slice(0, pos) + ext)
}

function cleanupRequest (request) {
  // Delete assets from disk
  for (const filename of assetsForRequest(request)) {
    if (fs.existsSync(filename)) {
      fs.unlinkSync(filename)
    }
  }

  // Remove from the database
  db.db().prepare('DELETE FROM awards_requests WHERE id = ?').run(request.id)
}

function cleanupAwards (awards) {
  const stmtDelAward = db.db().prepare('DELETE FROM awards WHERE id = ?')
  const stmtDelSegments = db.db().prepare('DELETE FROM segments WHERE awardId = ?')

  db.begin()
  let success = false
  try {
    for (const award of awards) {
      stmtDelSegments.run(award.id)
      stmtDelAward.run(award.id)
    }
    success = true
  } finally {
    success ? db.commit() : db.rollback()
  }
}

function copyAttributes (obj, attrs) {
  return attrs.reduce((ret, key) => {
    ret[key] = obj[key]
    return ret
  }, {})
}

function deepFreeze (obj, levels = -1) {
  // Do we have an array? If so, freeze each element
  if (Array.isArray(obj)) {
    obj = [...obj]
    for (let idx = 0; idx < obj.length; idx++) {
      const ele = obj[idx]
      if (typeof ele === 'object' && ele !== null) {
        obj[idx] = deepFreeze(ele, (levels > 0) ? levels - 1 : levels)
      }
    }
    return Object.freeze(obj)
  }

  // Handle objects with properties
  obj = {...obj}
  if (levels !== 0) {
    // Retrieve the property names defined on obj
    var propNames = Object.getOwnPropertyNames(obj)

    // Freeze properties before freezing self
    propNames.forEach((name) => {
      const prop = obj[name]
      if (typeof prop === 'object' && prop !== null) {
        obj[name] = deepFreeze(prop, (levels > 0) ? levels - 1 : levels)
      }
    })
  }
  return Object.freeze(obj)
}

function loadRequest (row) {
  // Build row
  const request = {
    query: copyAttributes(row, [
      'engine',
      'partners',
      'fromCity',
      'toCity',
      'departDate',
      'returnDate',
      'cabin',
      'quantity'
    ])
  }

  // Transform attributes
  request.departDate = request.departDate ? DateTime.fromSQL(request.departDate) : null
  request.returnDate = request.returnDate ? DateTime.fromSQL(request.returnDate) : null

  // Load HTML and JSON assets
  const { html = null, json = null, screenshots = null } = JSON.parse(row.assets)
  const loadAsset = (asset) => {
    // Read file, and decompress if necessary
    asset.contents = fs.readFileSync(asset.path)
    if (path.extname(asset.path) === '.gz') {
      asset.contents = zlib.gunzipSync(asset.contents)
    }
  }
  if (html) {
    html.forEach((x) => { loadAsset(x) })
    request.html = html
  }
  if (json) {
    json.forEach((x) => { loadAsset(x); x.contents = JSON.parse(x.contents) })
    request.json = json
  }
  if (screenshots) {
    request.screenshots = screenshots
  }

  return request
}

function promptYesNo (question, defaultChoice = 'yes') {
  const valid = { 'yes': true, 'y': true, 'no': false, 'n': false }

  let strPrompt = ' [y/n] '
  if (defaultChoice === 'yes') {
    strPrompt = ' [Y/n] '
  } else if (defaultChoice === 'no') {
    strPrompt = ' [y/N] '
  } else if (defaultChoice) {
    throw new Error('Invalid defaultChoice: ' + defaultChoice)
  }

  while (true) {
    const choice = prompt(question + strPrompt).toLowerCase()
    if (defaultChoice && choice === '') {
      return valid[defaultChoice]
    } else if (choice in valid) {
      return valid[choice]
    } else {
      console.log(`Please respond with 'yes' or 'no' (or 'y' or 'n').`)
    }
  }
}

function saveRequest (results) {
  // Create assets map (only needs ot have paths)
  const { html, json, screenshots } = results
  const assets = Object.entries({ html, json, screenshots })
    .reduce((assets, entry) => {
      const [ key, arr ] = entry
      if (arr && arr.length) {
        assets[key] = arr.map(x => ({ path: x.path, name: x.name }))
      }
      return assets
    }, {})

  // Build the row data
  const row = copyAttributes(results.query, [
    'engine',
    'partners',
    'fromCity',
    'toCity',
    'departDate',
    'returnDate',
    'cabin',
    'quantity'
  ])
  row.departDate = row.departDate ? row.departDate.toSQLDate() : null
  row.returnDate = row.returnDate ? row.returnDate.toSQLDate() : null
  row.assets = JSON.stringify(assets)

  // Insert the row
  return db.insertRow('requests', row).lastInsertROWID
}

function saveAwards (requestId, awards) {
  const ids = []

  // Wrap everything in a transaction
  let success = false
  db.begin()
  try {
    for (const award of awards) {
      // Build the row data
      const row = copyAttributes(award, [
        'engine',
        'partner',
        'fromCity',
        'toCity',
        'cabin',
        'mixed',
        'duration',
        'stops',
        'quantity',
        'mileage',
        'fees',
        'fares'
      ])
      row.requestId = requestId

      // Save the individual award and get it's ID
      const awardId = db.insertRow('awards', row).lastInsertROWID
      ids.push(awardId)

      // Now add each segment
      const segments = award.segments || []
      segments.forEach((segment, position) => {
        saveSegment(awardId, position, segment)
      })
    }
    success = true
  } finally {
    success ? db.commit() : db.rollback()
  }
  return success ? ids : null
}

function saveSegment (awardId, position, segment) {
  // Build the row data
  const row = copyAttributes(segment, [
    'airline',
    'flight',
    'aircraft',
    'fromCity',
    'toCity',
    'date',
    'departure',
    'arrival',
    'duration',
    'nextConnection',
    'cabin',
    'stops',
    'lagDays',
    'bookingCode'
  ])
  row.awardId = awardId
  row.position = position

  // Save the individual award and get it's ID
  return db.insertRow('segments', row).lastInsertROWID
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

module.exports = {
  addPlaceholders,
  appendPath,
  assetsForRequest,
  changeExtension,
  cleanupRequest,
  cleanupAwards,
  copyAttributes,
  deepFreeze,
  loadRequest,
  promptYesNo,
  saveRequest,
  saveAwards,
  saveSegment,
  randomDuration,
  randomInt,
  truthy
}
