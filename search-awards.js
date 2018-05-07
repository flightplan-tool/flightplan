const fs = require('fs')
const minimist = require('minimist')
const moment = require('moment')
const prompt = require('syncprompt')

const airlines = require('./airlines')
const accounts = require('./lib/accounts')
const { paths, cabins } = require('./lib/consts')
const { printRoute } = require('./lib/utils')
const db = require('./lib/db')

const USAGE = `
Usage: search-awards.js [OPTIONS]

  Search an airline website for award inventory, and save the results to disk.

Options:
  -m, --method          IATA 2-letter code of the airline whose website to search
  -f, --from CITY       IATA 3-letter code of the departure city
  -t, --to CITY         IATA 3-letter code of the arrival city
  -o, --oneway          Searches for one-way award inventory only (default is to search in both directions)
  -c, --cabin           Cabin (${Object.keys(cabins).join(', ')})
  -s, --start           Starting date of the search range (YYYY-MM-DD)
  -e, --end             Ending date of the search range (YYYY-MM-DD)
  -p, --passengers      # of passengers traveling (Defaults to 1)
  -a, --account         Index of account to use (0=first, will wrap if not enough accounts available)
  -h, --headful         Run browser in non-headless mode

Supported Methods:
${Object.keys(airlines).sort().map(id => (
  `  ${id} - ${airlines[id].Engine.config.name}`
)).join('\n')}
`

function pathForQuery (query) {
  const { method, fromCity, toCity, departDate } = query
  const fields = [
    method,
    fromCity,
    toCity,
    departDate.format('YYYY-MM-DD'),
    (new Date()).getTime()
  ]
  return `${paths.data}/${fields.join('-')}`
}

async function canSkip (query) {
  try {
    const { fromCity, toCity, cabin, departDate, returnDate, quantity } = query

    // Prepare paramters
    const departStr = departDate ? departDate.format('YYYY-MM-DD') : null
    const returnStr = returnDate ? returnDate.format('YYYY-MM-DD') : null
    const cities = [fromCity, toCity]
    const dates = [departStr, returnStr || departStr]
    let sql, params

    // First, get the set of rows which might be interesting
    sql = 'SELECT * FROM awards_requests WHERE cabin = ? AND ' +
      'fromCity IN (?, ?) AND toCity IN (?, ?) AND ' +
      'departDate IN (?, ?) AND (returnDate IN (?, ?) OR returnDate IS NULL)'
    params = [cabin, ...cities, ...cities, ...dates, ...dates]
    const routes = []
    for (const row of await db.db().all(sql, ...params)) {
      // Add the departing route
      routes.push([row.fromCity, row.toCity, row.departDate, row.quantity])

      // Add the return route
      if (row.returnDate) {
        routes.push([row.toCity, row.fromCity, row.returnDate, row.quantity])
      }
    }

    // Check if our route is covered
    const departRoute = routes.find(x => (
      x[0] === fromCity && x[1] === toCity && x[2] === departStr && x[3] === quantity
    ))
    const returnRoute = !returnDate || routes.find(x => (
      x[0] === toCity && x[1] === fromCity && x[2] === returnStr && x[3] === quantity
    ))
    if (departRoute && returnRoute) {
      return true
    }

    // // If we already know there's no inventory for both routes, we can also skip
    // sql = 'SELECT * FROM awards WHERE cabin = ? AND ' +
    //   'fromCity IN (?, ?) AND toCity IN (?, ?) AND date IN (?, ?)'
    // params = [cabin, ...cities, ...cities, ...dates]
    // const awards = []
    // for (const row of await db.db().all(sql, ...params)) {
    //   // Add the award
    //   awards.push([row.fromCity, row.toCity, row.date, row.quantity, row.fares])
    // }
    // const departRestricted = awards.find(x => (
    //     x[0] === fromCity && x[1] === toCity && x[2] === departStr && x[3] <= quantity && !x[4]
    // ))
    // const returnRestricted = returnDate && awards.find(x => (
    //     x[0] === toCity && x[1] === fromCity && x[2] === returnStr && x[3] <= quantity && !x[4]
    // ))
    // return (departRestricted && returnRestricted)

    return false
  } catch (e) {
    throw e
  }
}

function validCabin (engine, cabin) {
  const fares = Object.values(engine.config.fares)
  const cabinSet = new Set([...fares.map(x => x.cabin)])
  if (!cabinSet.has(cabin)) {
    engine.error(`This method does not support the cabin "${cabin}"`)
    return false
  }
  return true
}

function validDates (engine, startDate, endDate) {
  // Calculate the valid range allowed by the engine
  const { minDays, maxDays } = engine.config.validation
  const now = moment().startOf('d')
  const a = now.clone().add(minDays, 'd')
  const b = now.clone().add(maxDays, 'd')

  // Check if our search range is completely outside the valid range
  if (endDate.isBefore(a, 'd') || startDate.isAfter(b, 'd')) {
    engine.error(`This method only supports searching within the range: ${a.format('L')} -> ${b.format('L')}`)
    return [null, null]
  }

  // If only start or end are outside the valid range, we can adjust them
  if (startDate.isBefore(a, 'd')) {
    engine.info(`This method can only search from ${minDays} day(s) from today, adjusting start of search range to: ${a.format('L')}`)
    startDate = a
  }
  if (endDate.isAfter(b, 'd')) {
    engine.info(`This method can only search up to ${maxDays} day(s) from today, adjusting end of search range to: ${b.format('L')}`)
    endDate = b
  }
  return [startDate, endDate]
}

const main = async () => {
  // Parse arguments
  const argv = minimist(process.argv, {boolean: ['o', 'oneway', 'h', 'headful']})
  if (['help', '?', '?'].find(x => x in argv)) {
    console.log(USAGE)
    return
  }
  let method = argv['m'] || argv['method']
  let fromCity = argv['f'] || argv['from']
  let toCity = argv['t'] || argv['to']
  let oneWay = argv['o'] || argv['oneway']
  let cabin = argv['c'] || argv['cabin']
  let startDate = argv['s'] || argv['start']
  let endDate = argv['e'] || argv['end']
  let passengers = argv['p'] || argv['passengers'] || 1
  let accountIdx = argv['a'] || argv['account'] || 0
  let headless = !(argv['h'] || argv['headful'])

  // Fill in missing arguments
  if (!method) {
    method = prompt('Airline website to search (2-letter code)? ')
  }
  if (!fromCity) {
    fromCity = prompt('Departure city (3-letter code)? ')
  }
  if (!toCity) {
    toCity = prompt('Arrival city (3-letter code)? ')
  }
  if (!cabin) {
    cabin = prompt(`Desired cabin class (${Object.keys(cabins).join('/')}})? `)
  }
  if (!startDate) {
    startDate = prompt('Start date of search range (YYYY-MM-DD)? ')
  }
  if (!endDate) {
    endDate = prompt('End date of search range (YYYY-MM-DD)? ')
  }

  // Validate arguments
  if (!(method in airlines)) {
    console.error(`Unrecognized search method: ${method}`)
    return
  }
  if (!(cabin in cabins)) {
    console.error(`Unrecognized cabin specified: ${cabin}`)
    return
  }
  startDate = moment(startDate)
  if (!startDate.isValid()) {
    console.error(`Invalid start date: ${startDate}`)
  }
  endDate = moment(endDate)
  if (!endDate.isValid()) {
    console.error(`Invalid end date: ${endDate}`)
  }
  if (endDate.isBefore(startDate)) {
    console.error(`Invalid date range for search: ${startDate.format('L')} -> ${endDate.format('L')}`)
    return
  }

  // Resolve method and validate cabin, date range, trip type
  method = airlines[method]
  if (!validCabin(method.Engine, cabin)) {
    return
  }
  [ startDate, endDate ] = validDates(method.Engine, startDate, endDate)
  if (!startDate || !endDate) {
    return
  }
  if (oneWay && !method.Engine.config.oneWaySupported) {
    console.error('One-way searches are not supported by this method')
    return
  }

  let engine
  try {
    // Create data path if necessary
    if (!fs.existsSync(paths.data)) {
      fs.mkdirSync(paths.data)
    }

    // Create database if necessary, and then open
    await db.migrate()
    await db.open()

    // Load cookies from database
    const cookies = await db.loadCookies()

    // Generate queries
    const { tripMinDays, oneWaySupported } = method.Engine.config
    const days = endDate.diff(startDate, 'd') + 1
    const gap = oneWay ? 0 : Math.min(tripMinDays, days)
    const queries = []

    // Compute the one-way segments coming back at beginning of search range
    for (let i = 0; i < gap; i++) {
      queries.push({
        fromCity: toCity,
        toCity: fromCity,
        departDate: startDate.clone().add(i, 'd'),
        returnDate: oneWaySupported ? null : startDate.clone().add(i + tripMinDays, 'd')
      })
    }

    // Compute segments in middle of search range
    const departDate = startDate.clone()
    const returnDate = startDate.clone().add(gap, 'd')
    for (let i = 0; i < days - gap; i++) {
      queries.push({
        fromCity,
        toCity,
        departDate: departDate.clone(),
        returnDate: oneWay ? null : returnDate.clone()
      })
      departDate.add(1, 'd')
      returnDate.add(1, 'd')
    }

    // Compute the one-way segments going out at end of search range
    for (let i = gap - 1; i >= 0; i--) {
      if (oneWaySupported) {
        queries.push({
          fromCity,
          toCity,
          departDate: endDate.clone().subtract(i, 'd')
        })
      } else {
        queries.push({
          fromCity: toCity,
          toCity: fromCity,
          departDate: endDate.clone().subtract(i + tripMinDays, 'd'),
          returnDate: endDate.clone().subtract(i, 'd')
        })
      }
    }

    // Fill in info that's universal for each query
    queries.forEach(q => {
      q.method = method.Engine.id
      q.cabin = cabin
      q.quantity = passengers
    })

    // Execute queries
    let skipped = 0
    console.log(`Searching ${days} days of award inventory (${startDate.format('L')} - ${endDate.format('L')})`)
    for (const query of queries) {
      // Check if the query's results are already stored
      if (await canSkip(query)) {
        skipped++
        continue
      }

      // Lazy load the search engine
      if (!engine) {
        const account = method.Engine.accountRequired
          ? accounts.getCredentials(method.Engine.id, accountIdx) : {}
        const options = {...account, headless, cookies, timeout: 5 * 60000}
        engine = await method.Engine.new(options)
        if (!engine) {
          method.Engine.error('Failed to initialize search engine')
          return
        }
      }

      // Throttle before executing search
      await engine.throttle()

      // Print route(s) being searched
      printRoute(query)

      // Run the search query
      try {
        const basePath = pathForQuery(query)
        query.htmlFile = basePath + '.html.gz'
        query.screenshot = basePath + '.jpg'
        if (await engine.search(query)) {
          // Write to database
          const row = {...query}
          row.departDate = row.departDate ? row.departDate.format('YYYY-MM-DD') : null
          row.returnDate = row.returnDate ? row.returnDate.format('YYYY-MM-DD') : null
          const fields = [
            'method', 'fromCity', 'toCity', 'departDate', 'returnDate', 'cabin', 'quantity', 'htmlFile'
          ]
          await db.insertRow('awards_requests', row, fields)
        }
      } catch (e) {
        console.error('Search failed:', e)
      }
    }
    if (skipped > 0) {
      console.log(`Skipped ${skipped} queries.`)
    }
    console.log('Search complete!')

    // Save cookies to database
    if (engine) {
      await db.saveCookies(await engine.getCookies())
    }
  } catch (e) {
    console.error(e.stack)
  } finally {
    // Cleanup
    if (engine) {
      await engine.close()
    }
    await db.close()
  }
}

main()
