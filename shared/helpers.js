const fs = require('fs')
const chalk = require('chalk')

const db = require('./db')
const Query = require('../src/Query')
const Results = require('../src/Results')

function createPlaceholders (results, options = {}) {
  const { engine, query } = results
  const { fromCity, toCity, departDate, returnDate, quantity } = query
  const rows = []

  // Helper function to add a placeholder
  const fn = (fromCity, toCity, date, cabin) => {
    if (date) {
      rows.push({
        engine,
        fromCity,
        toCity,
        date,
        cabin,
        quantity,
        partner: false,
        mixed: false,
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
  return rows
}

function assetsForRequest (request) {
  const {
    html = [],
    json = [],
    screenshot = []
  } = JSON.parse(request.assets)
  return [...html, ...json, ...screenshot].map(x => x.path)
}

function cleanupRequest (request) {
  // Delete assets from disk
  for (const filename of assetsForRequest(request)) {
    if (fs.existsSync(filename)) {
      fs.unlinkSync(filename)
    }
  }

  // Remove from the database
  db.db().prepare('DELETE FROM requests WHERE id = ?').run(request.id)
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
  // Create Results from row
  return Results.parse({
    engine: row.engine,
    query: new Query({
      partners: row.partners,
      fromCity: row.fromCity,
      toCity: row.toCity,
      departDate: row.departDate,
      returnDate: row.returnDate,
      cabin: row.cabin,
      quantity: row.quantity
    }),
    ...JSON.parse(row.assets)
  })
}

function saveRequest (results) {
  // Get assets (only needs to have paths)
  const { assets } = results.trimContents()

  // Build the row data
  const { query } = results
  const row = {
    engine: results.engine,
    partners: query.partners,
    fromCity: query.fromCity,
    toCity: query.toCity,
    departDate: query.departDate,
    returnDate: query.returnDate,
    cabin: query.cabin,
    quantity: query.quantity,
    assets: JSON.stringify(assets)
  }

  // Insert the row
  return db.insertRow('requests', row).lastInsertROWID
}

function saveAwards (requestId, awards, placeholders, query) {
  const ids = []

  // first clean the awards in db for the given route
  const chalkContext = chalk.bold(`[${query.engine}]`)
  console.log(chalk.yellow(`${chalkContext} CLEANUP [${query.fromCity} -> ${query.toCity}] - ${query.departDate}`))
  const awardQuery = createAwardQuery(query.fromCity, query.toCity, 'oneway', query.departDate, query.departDate, 0, query.cabin, query.engine, query.limit)
  const existingAwards = db.db().prepare(awardQuery.query).all(...awardQuery.params)
  cleanupAwards(existingAwards);

  // Transform objects to rows
  const rows = [ ...placeholders ]
  for (const award of awards) {
    rows.push({
      engine: award.engine,
      partner: award.partner,
      fromCity: award.flight.fromCity,
      toCity: award.flight.toCity,
      date: award.flight.date,
      cabin: award.fare.cabin,
      mixed: award.mixedCabin,
      duration: award.flight.duration,
      stops: award.flight.stops,
      quantity: award.quantity,
      mileage: award.mileageCost,
      fees: award.fees,
      fares: `${award.fare.code}${award.waitlisted ? '@' : '+'}`,
      segments: award.flight.segments
    })
  }

  // Wrap everything in a transaction
  let success = false
  db.begin()
  try {
    for (const row of rows) {
      const { segments } = row
      delete row.segments

      // Save the individual award and get it's ID
      row.requestId = requestId
      const awardId = db.insertRow('awards', row).lastInsertROWID
      ids.push(awardId)

      // Now add each segment
      if (segments) {
        segments.forEach((segment, position) => {
          saveSegment(awardId, position, segment)
        })
      }
    }
    success = true
  } finally {
    success ? db.commit() : db.rollback()
  }
  return success ? ids : null
}

function saveSegment (awardId, position, segment) {
  // Build the row data
  const row = {
    airline: segment.airline,
    flight: segment.flight,
    aircraft: segment.aircraft,
    fromCity: segment.fromCity,
    toCity: segment.toCity,
    date: segment.date,
    departure: segment.departure,
    arrival: segment.arrival,
    duration: segment.duration,
    nextConnection: segment.nextConnection,
    cabin: segment.cabin,
    stops: segment.stops,
    lagDays: segment.lagDays
  }
  row.awardId = awardId
  row.position = position

  // Save the individual award and get it's ID
  return db.insertRow('segments', row).lastInsertROWID
}

function createAwardQuery(fromCity, toCity, direction, startDate, endDate, quantity, cabin, engine, limit) {
  let query = 'SELECT * FROM awards WHERE '
    const params = []

    // Add cities
    const cities = [ fromCity.toUpperCase(), toCity.toUpperCase() ]
    if (direction === 'oneway') {
      query += 'fromCity = ? AND toCity = ?'
      params.push(...cities)
    } else if (direction === 'roundtrip') {
      query += '((fromCity = ? AND toCity = ?) OR (toCity = ? AND fromCity = ?))'
      params.push(...cities, ...cities)
    } else {
      throw new Error('Unrecognized direction parameter:', direction)
    }

    // Add dates
    query += ' AND date BETWEEN ? AND ?'
    params.push(startDate, endDate)

    // Add quantity
    query += ' AND quantity >= ?'
    params.push(parseInt(quantity))

    // Add cabins
    if (cabin) {
      const values = cabin.split(',')
      query += ` AND cabin IN (${values.map(x => '?').join(',')})`
      values.forEach(x => params.push(x))
    }

    // Add engine
    if (engine) {
      query += ' AND engine = ?'
      params.push(engine);
    }

    // Add limit
    if (limit) {
      query += ' LIMIT ?'
      params.push(parseInt(limit))
    }

    return {
      query,
      params
    }
}

module.exports = {
  createPlaceholders,
  assetsForRequest,
  cleanupRequest,
  cleanupAwards,
  loadRequest,
  saveRequest,
  saveAwards,
  saveSegment,
  createAwardQuery
}
