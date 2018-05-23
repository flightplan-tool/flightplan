const db = require('./db')
const paths = require('./paths')

function path (route) {
  const { engine, fromCity, toCity, departDate } = route
  const fields = [
    engine,
    fromCity,
    toCity,
    departDate.format('YYYY-MM-DD'),
    (new Date()).getTime()
  ]
  return `${paths.data}/${fields.join('-')}`
}

function print (route) {
  const { engine, fromCity, toCity, departDate, returnDate, quantity } = route

  if (!departDate && !returnDate) {
    console.log('Weird...')
  }

  // Passenger details
  const strPax = `${quantity} ${quantity > 1 ? 'Passengers' : 'Passenger'}`

  // Format dates if necessary
  const departStr = (departDate && typeof departDate !== 'string')
    ? departDate.format('L') : departDate
  const returnStr = (returnDate && typeof returnDate !== 'string')
    ? returnDate.format('L') : returnDate

  // Print departure and arrival routes
  console.log(`${engine}: DEPARTURE [${fromCity} -> ${toCity}] - ${departStr} (${strPax})`)
  if (returnDate) {
    console.log(`${engine}: ARRIVAL   [${toCity} -> ${fromCity}] - ${returnStr}`)
  }
}

function key (row, date, reverse = false) {
  let { engine, cabin, fromCity, toCity } = row
  const dateStr = (date && typeof date !== 'string')
    ? date.format('YYYY-MM-DD') : date
  return [engine, cabin, reverse ? toCity : fromCity, reverse ? fromCity : toCity, dateStr].join('|')
}

function getOrSet (map, key) {
  let ret = map.get(key)
  if (ret === undefined) {
    ret = { requests: [], awards: [] }
    map.set(key, ret)
  }
  return ret
}

async function find (route) {
  const map = new Map()

  // Update map with award requests
  await requests(route, (err, row) => {
    const { departDate, returnDate } = row
    let obj = getOrSet(map, key(row, departDate))
    obj.requests.push(row)
    if (returnDate) {
      obj = getOrSet(map, key(row, returnDate, true))
      obj.requests.push(row)
    }
  })

  // Now update with awards
  await awards(route, (err, row) => {
    let obj = getOrSet(map, key(row, row.date))
    obj.awards.push(row)
  })

  return map
}

function requests (route, cb) {
  // If no route defined, just select all records
  if (!route) {
    return db.db().each('SELECT * FROM awards_requests', cb)
  }

  // Format dates
  const { engine, cabin, quantity, fromCity, toCity, departDate, returnDate } = route
  const departStr = departDate ? departDate.format('YYYY-MM-DD') : null
  const returnStr = returnDate ? returnDate.format('YYYY-MM-DD') : null

  // Select only the relevant segments
  if (returnDate) {
    // Round-Trip route
    const sql = 'SELECT * FROM awards_requests WHERE ' +
      'engine = ? AND cabin = ? AND quantity = ? AND (' +
        '(fromCity = ? AND toCity = ? AND (departDate = ? OR returnDate = ?)) OR ' +
        '(fromCity = ? AND toCity = ? AND (departDate = ? OR returnDate = ?)))'
    return db.db().each(sql, engine, cabin, quantity,
      fromCity, toCity, departStr, returnStr,
      toCity, fromCity, returnStr, departStr,
      cb)
  } else {
    // One-Way route
    const sql = 'SELECT * FROM awards_requests WHERE ' +
      'engine = ? AND cabin = ? AND quantity = ? AND (' +
        '(fromCity = ? AND toCity = ? AND departDate = ?) OR ' +
        '(fromCity = ? AND toCity = ? AND returnDate = ?))'
    return db.db().each(sql, engine, cabin, quantity,
      fromCity, toCity, departStr,
      toCity, fromCity, departStr,
      cb)
  }
}

function awards (route, cb) {
  // If no route defined, just select all records
  if (!route) {
    return db.db().each('SELECT * FROM awards', cb)
  }

  // Format dates
  const { engine, cabin, quantity, fromCity, toCity, departDate, returnDate } = route
  const departStr = departDate ? departDate.format('YYYY-MM-DD') : null
  const returnStr = returnDate ? returnDate.format('YYYY-MM-DD') : null

  // Select only the relevant segments
  if (returnDate) {
    // Round-Trip route
    const sql = 'SELECT * FROM awards WHERE ' +
      'engine = ? AND cabin = ? AND quantity <= ? AND (' +
        '(fromCity = ? AND toCity = ? AND date = ?) OR ' +
        '(fromCity = ? AND toCity = ? AND date = ?))'
    return db.db().each(sql, engine, cabin, quantity,
      fromCity, toCity, departStr,
      toCity, fromCity, returnStr,
      cb)
  } else {
    // One-Way route
    const sql = 'SELECT * FROM awards WHERE ' +
      'engine = ? AND cabin = ? AND quantity <= ? AND ' +
        'fromCity = ? AND toCity = ? AND date = ?'
    return db.db().each(sql, engine, cabin, quantity,
      fromCity, toCity, departStr,
      cb)
  }
}

module.exports = {
  path,
  key,
  find,
  print
}
