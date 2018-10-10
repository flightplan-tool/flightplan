const fs = require('fs')
const { DateTime } = require('luxon')
const path = require('path')
const zlib = require('zlib')

const db = require('./db')
const utils = require('./utils')

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

function assetsForRequest (request) {
  const {
    html = [],
    json = [],
    screenshots = []
  } = JSON.parse(request.assets)
  return [...html, ...json, ...screenshots].map(x => x.path)
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

function loadRequest (row) {
  // Build row
  const request = {
    query: utils.copyAttributes(row, [
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
  const row = utils.copyAttributes(results.query, [
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
      const row = utils.copyAttributes(award, [
        'engine',
        'partner',
        'fromCity',
        'toCity',
        'date',
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
  const row = utils.copyAttributes(segment, [
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

module.exports = {
  addPlaceholders,
  assetsForRequest,
  cleanupRequest,
  cleanupAwards,
  loadRequest,
  saveRequest,
  saveAwards,
  saveSegment
}
