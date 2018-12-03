const express = require('express')

const fp = require('../src')
const db = require('../shared/db')
const logger = require('../shared/logger')
const utils = require('../src/utils')

const app = express()
const port = process.env.PORT || 5000

app.get('/api/config', async (req, res, next) => {
  try {
    // Insert each website engine
    const engines = fp.supported().map((id) => {
      const config = fp.new(id).config.toJSON()
      const { name, website, fares } = config
      return { id, name, website, fares }
    })

    // Get list of all aircraft and airlines
    const aircraft = fp.aircraft
    const airlines = fp.airlines

    // Specify the available cabin options
    const cabins = [
      { value: fp.cabins.first, label: 'First' },
      { value: fp.cabins.business, label: 'Business' },
      { value: fp.cabins.premium, label: 'Prem. Economy' },
      { value: fp.cabins.economy, label: 'Economy' }
    ]

    res.send({engines, aircraft, airlines, cabins})
  } catch (err) {
    next(err)
  }
})

app.get('/api/search', async (req, res, next) => {
  try {
    const {
      fromCity = '',
      toCity = '',
      quantity = '1',
      direction = 'oneway',
      startDate = '',
      endDate = '',
      cabin,
      limit
    } = req.query

    // Validate dates
    if (!utils.validDate(startDate)) {
      throw new Error('Invalid start date:', startDate)
    }
    if (!utils.validDate(endDate)) {
      throw new Error('Invalid end date:', endDate)
    }
    if (endDate < startDate) {
      throw new Error(`Invalid date range for search: ${startDate} -> ${endDate}`)
    }

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

    // Add limit
    if (limit) {
      query += ' LIMIT ?'
      params.push(parseInt(limit))
    }

    // Run SQL query
    console.time('search')
    let awards = db.db().prepare(query).all(...params)

    // Fetch segments for each award
    const stmt = db.db().prepare('SELECT * FROM segments WHERE awardId = ?')
    for (const award of awards) {
      award.segments = stmt.all(award.id)
    }
    console.timeEnd('search')

    res.send(awards)
  } catch (err) {
    next(err)
  }
})

const main = async () => {
  try {
    // Open database
    console.log('Opening database...')
    db.open()

    // Launch Express server
    console.log(`Running web server on port: ${port}`)
    await app.listen(port)
    console.log('Success!')
  } catch (err) {
    logger.error(err)
  }
}

main()
