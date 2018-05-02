const express = require('express')
const db = require('sqlite')
const moment = require('moment')

const { truthy } = require('./lib/utils')

const app = express()
const port = process.env.PORT || 8000

app.get('/search', async (req, res, next) => {
  try {
    const {
      fromCity,
      toCity,
      cabinClass,
      passengers = '1',
      direction = 'oneway',
      showWaitlisted = 'true',
      startDate,
      endDate,
      airlines,
      flights,
      limit
    } = req.query

    console.log('QUERY:', req.query)

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

    // Do further filtering
    const hideWaitlisted = !truthy(showWaitlisted)
    if (cabinClass || hideWaitlisted) {
      awards.forEach(award => {
        let { fareCodes } = award
        fareCodes = fareCodes.split(' ')
        if (cabinClass) {
          fareCodes = fareCodes.filter(x => x.startsWith(cabinClass))
        }
        if (hideWaitlisted) {
          fareCodes = fareCodes.filter(x => !x.includes('@'))
        }
        award.fareCodes = fareCodes.join(' ')
      })
      awards = awards.filter(x => x.fareCodes.length !== 0)
    }

    res.send(awards)
  } catch (err) {
    next(err)
  }
})

// First, try to open the database
db.open('./db/database.sqlite3', { Promise })
  // Update db schema to the latest version using SQL-based migrations
  // .then(() => db.migrate({ force: 'last' }))
  // Launch the Node.js app
  .then(() => app.listen(port))
  // Display error message if something went wrong
  .catch((err) => console.error(err.stack))
