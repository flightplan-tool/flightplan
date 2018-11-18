const chalk = require('chalk')

const db = require('./db')
const paths = require('./paths')

function path (route) {
  const { engine, fromCity, toCity, departDate } = route
  const fields = [
    engine,
    fromCity,
    toCity,
    departDate,
    (new Date()).getTime()
  ]
  return `${paths.data}/${fields.join('-')}`
}

function key (row, date, reverse = false) {
  let { engine, cabin, fromCity, toCity } = row
  return [engine, cabin, reverse ? toCity : fromCity, reverse ? fromCity : toCity, date].join('|')
}

function getOrSet (map, key) {
  let ret = map.get(key)
  if (ret === undefined) {
    ret = { requests: [], awards: [] }
    map.set(key, ret)
  }
  return ret
}

function find (route, database = db.db()) {
  const map = new Map()

  // Update map with award requests
  for (const row of requests(route, database)) {
    const { departDate, returnDate } = row
    let obj = getOrSet(map, key(row, departDate))
    obj.requests.push(row)
    if (returnDate) {
      obj = getOrSet(map, key(row, returnDate, true))
      obj.requests.push(row)
    }
  }

  // Now update with awards
  for (const row of awards(route, database)) {
    let obj = getOrSet(map, key(row, row.date))
    obj.awards.push(row)
  }

  return map
}

function requests (route, database) {
  // If no route defined, just select all records
  if (!route) {
    return database.prepare('SELECT * FROM requests').all()
  }

  // Format dates
  const { engine, partners, cabin, quantity, fromCity, toCity, departDate, returnDate } = route
  const departStr = departDate || null
  const returnStr = returnDate || null

  // Select only the relevant segments
  if (returnDate) {
    // Round-Trip route
    const sql = 'SELECT * FROM requests WHERE ' +
      'engine = ? AND partners = ? AND cabin = ? AND quantity = ? AND (' +
        '(fromCity = ? AND toCity = ? AND (departDate = ? OR returnDate = ?)) OR ' +
        '(fromCity = ? AND toCity = ? AND (departDate = ? OR returnDate = ?)))'
    return database.prepare(sql).all(
      engine, partners ? 1 : 0, cabin, quantity,
      fromCity, toCity, departStr, returnStr,
      toCity, fromCity, returnStr, departStr
    )
  } else {
    // One-Way route
    const sql = 'SELECT * FROM requests WHERE ' +
      'engine = ? AND partners = ? AND cabin = ? AND quantity = ? AND (' +
        '(fromCity = ? AND toCity = ? AND departDate = ?) OR ' +
        '(fromCity = ? AND toCity = ? AND returnDate = ?))'
    return database.prepare(sql).all(
      engine, partners ? 1 : 0, cabin, quantity,
      fromCity, toCity, departStr,
      toCity, fromCity, departStr
    )
  }
}

function awards (route, database) {
  // If no route defined, just select all records
  if (!route) {
    return database.prepare('SELECT * FROM awards').all()
  }

  // Format dates
  const { engine, cabin, quantity, fromCity, toCity, departDate, returnDate } = route
  const departStr = departDate || null
  const returnStr = returnDate || null

  // Select only the relevant segments
  if (returnDate) {
    // Round-Trip route
    const sql = 'SELECT * FROM awards WHERE ' +
      'engine = ? AND cabin = ? AND quantity <= ? AND (' +
        '(fromCity = ? AND toCity = ? AND date = ?) OR ' +
        '(fromCity = ? AND toCity = ? AND date = ?))'
    return database.prepare(sql).all(
      engine, cabin, quantity,
      fromCity, toCity, departStr,
      toCity, fromCity, returnStr
    )
  } else {
    // One-Way route
    const sql = 'SELECT * FROM awards WHERE ' +
      'engine = ? AND cabin = ? AND quantity <= ? AND ' +
        'fromCity = ? AND toCity = ? AND date = ?'
    return database.prepare(sql).all(
      engine, cabin, quantity,
      fromCity, toCity, departStr
    )
  }
}

function print (route) {
  const { engine, fromCity, toCity, departDate, returnDate, quantity } = route

  // Passenger details
  const strPax = `${quantity} ${quantity > 1 ? 'Passengers' : 'Passenger'}`

  // Format dates if necessary
  const departStr = (departDate && typeof departDate !== 'string')
    ? departDate : departDate
  const returnStr = (returnDate && typeof returnDate !== 'string')
    ? returnDate : returnDate

  // Print departure and arrival routes
  const context = chalk.bold(`[${engine}]`)
  console.log(chalk.blue(`${context} DEPARTURE [${fromCity} -> ${toCity}] - ${departStr} (${strPax})`))
  if (returnDate) {
    console.log(chalk.blue(`${context} ARRIVAL   [${toCity} -> ${fromCity}] - ${returnStr}`))
  }
}

module.exports = {
  path,
  key,
  find,
  print
}
