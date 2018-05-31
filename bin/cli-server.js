const express = require('express')
const db = require('sqlite')
const moment = require('moment')

const app = express()
const port = process.env.PORT || 5000

app.get('/api/search', async (req, res, next) => {
  try {
    const {
      fromCity,
      toCity,
      passengers = '1',
      direction = 'oneway',
      startDate,
      endDate,
      limit
    } = req.query

    // Validate dates
    const start = moment(startDate)
    const end = moment(endDate)
    if (!start.isValid()) {
      throw new Error('Invalid start date:', startDate)
    }
    if (!end.isValid()) {
      throw new Error('Invalid end date:', endDate)
    }
    if (end.isBefore(start)) {
      throw new Error(`Invalid date range for search: ${start.format('L')} -> ${end.format('L')}`)
    }

    let query = 'SELECT * FROM awards WHERE '
    const params = []

    // Add cities
    if (direction === 'oneway') {
      query += 'fromCity = ? AND toCity = ?'
      params.push(fromCity, toCity)
    } else if (direction === 'roundtrip') {
      query += '((fromCity = ? AND toCity = ?) OR (toCity = ? AND fromCity = ?))'
      params.push(fromCity, toCity, fromCity, toCity)
    } else {
      throw new Error('Unrecognized direction parameter:', direction)
    }

    // Add dates
    query += ' AND date BETWEEN ? AND ?'
    params.push(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'))

    // Add passenger count
    query += ' AND quantity >= ?'
    params.push(parseInt(passengers))

    // Add limit
    if (limit) {
      query += ' LIMIT ?'
      params.push(parseInt(limit))
    }

    // Run SQL query
    let awards = await db.all(query, ...params)

    res.send(awards)
  } catch (err) {
    next(err)
  }
})

// Launch the Node.js app
function run () {
  console.log(`Running web server on port: ${port}`)
  return app.listen(port)
}

// First, try to open the database
console.log('Opening database...')
db.open('./db/database.sqlite3', { Promise })
  // Update db schema to the latest version using SQL-based migrations
  // .then(() => db.migrate({ force: 'last' }))
  .then(() => run())
  .then(() => console.log('Success!'))
  .catch((err) => console.error(err.stack))
