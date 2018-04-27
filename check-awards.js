const minimist = require('minimist')
const moment = require('moment')
const prompt = require('syncprompt')
const sqlite = require('sqlite')

const credentials = require('./credentials')
const SQEngine = require('./engines/sq')
const consts = require('./lib/consts')
const { migrate, insertRow, loadCookies, saveCookies } = require('./lib/db')

const USAGE = `
Usage: check-awards.js [OPTIONS]

  Search an airline website for award inventory, and save the results to disk.

Options:                asdf
  -f, --from CITY       IATA 3-letter code of the departure city
  -t, --to CITY         IATA 3-letter code of the arrival city
  -o, --oneway          Searches for one-way award inventory only (default is to search in both directions)
  -c, --class           Cabin class (F=First, J=Business, Y=PremEcon, C=Economy)
  -s, --start           Starting date of the search range (YYYY-MM-DD)
  -e, --end             Ending date of the search range (YYYY-MM-DD)
  -a, --adults          # of adults traveling (Defaults to 1)
  -k, --children        # of children traveling (Defaults to 0)
  -h, --headful         Run browser in non-headless mode
`

function pathForQuery (query) {
  const { fromCity, toCity, departDate } = query
  const fields = [fromCity, toCity, departDate.format('YYYY-MM-DD'), (new Date()).getTime()]
  return `${consts.DATA_PATH}/${fields.join('-')}`
}

async function canSkip (query, db) {
  try {
    const { fromCity, toCity, cabinClass, departDate, returnDate, adults, children } = query

    // Prepare paramters
    const departStr = departDate ? departDate.format('YYYY-MM-DD') : null
    const returnStr = returnDate ? returnDate.format('YYYY-MM-DD') : null
    const cities = [fromCity, toCity]
    const dates = [departStr, returnStr || departStr]
    const quantity = adults + children
    let sql, params

    // First, get the set of rows which might be interesting
    sql = 'SELECT * FROM awards_requests WHERE cabinClass = ? AND ' +
      'fromCity IN (?, ?) AND toCity IN (?, ?) AND ' +
      'departDate IN (?, ?) AND (returnDate IN (?, ?) OR returnDate IS NULL)'
    params = [cabinClass, ...cities, ...cities, ...dates, ...dates]
    const routes = []
    for (const row of await db.all(sql, ...params)) {
      // Add the departing route
      routes.push([row.fromCity, row.toCity, row.departDate, row.adults + row.children])

      // Add the return route
      if (row.returnDate) {
        routes.push([row.toCity, row.fromCity, row.returnDate, row.adults + row.children])
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

    // If we already know there's no inventory for both routes, we can also skip
    sql = 'SELECT * FROM awards WHERE cabinClass = ? AND ' +
      'fromCity IN (?, ?) AND toCity IN (?, ?) AND date IN (?, ?)'
    params = [cabinClass, ...cities, ...cities, ...dates]
    const awards = []
    for (const row of await db.all(sql, ...params)) {
      // Add the award
      awards.push([row.fromCity, row.toCity, row.date, row.quantity, row.fareCodes])
    }
    const departRestricted = awards.find(x => (
        x[0] === fromCity && x[1] === toCity && x[2] === departStr && x[3] <= quantity && !x[4]
    ))
    const returnRestricted = returnDate && awards.find(x => (
        x[0] === toCity && x[1] === fromCity && x[2] === returnStr && x[3] <= quantity && !x[4]
    ))
    return (departRestricted && returnRestricted)
  } catch (e) {
    throw new Error('Failed to check database results')
  }
}

const main = async () => {
  let db, engine

  // Parse arguments
  const argv = minimist(process.argv, {boolean: ['o', 'oneway', 'h', 'headful']})
  if (['help', '?', '?'].find(x => x in argv)) {
    console.log(USAGE)
    return
  }
  let fromCity = argv['f'] || argv['from']
  let toCity = argv['t'] || argv['to']
  let oneWay = argv['o'] || argv['oneway']
  let cabinClass = argv['c'] || argv['class']
  let startDate = argv['s'] || argv['start']
  let endDate = argv['e'] || argv['end']
  let adults = argv['a'] || argv['adults'] || 1
  let children = argv['k'] || argv['children'] || 0
  let headless = !(argv['h'] || argv['headful'])

  // Fill in missing arguments
  if (!fromCity) {
    fromCity = prompt('Departure city (3-letter code)? ')
  }
  if (!toCity) {
    toCity = prompt('Arrival city (3-letter code)? ')
  }
  if (!cabinClass) {
    cabinClass = prompt('Desired cabin class (F/J/Y/C)? ')
  }
  if (!startDate) {
    startDate = prompt('Start date of search range (YYYY-MM-DD)? ')
  }
  if (!endDate) {
    endDate = prompt('End date of search range (YYYY-MM-DD)? ')
  }

  // Validate arguments
  cabinClass = cabinClass.toUpperCase()
  startDate = moment(startDate)
  endDate = moment(endDate)

  try {
    // Create database if necessary
    await migrate()

    // Open database
    db = await sqlite.open(consts.DB_PATH, { Promise })

    // Load cookies from database
    const cookies = await loadCookies(db)

    // Initialize search engine
    engine = new SQEngine({...credentials, headless, cookies})
    if (!await engine.initialize()) {
      throw new Error('Failed to initialize SQ engine!')
    }

    // Generate queries
    const queries = []
    const days = endDate.diff(startDate, 'd') + 1
    const gap = oneWay ? 0 : Math.min(consts.GAP_DAYS, days)
    for (let i = 0; i < gap; i++) {
      queries.push({
        fromCity: toCity,
        toCity: fromCity,
        departDate: startDate.clone().add(i, 'd')
      })
    }
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
    for (let i = gap - 1; i >= 0; i--) {
      queries.push({
        fromCity,
        toCity,
        departDate: endDate.clone().subtract(i, 'd')
      })
    }
    queries.forEach(q => {
      q.cabinClass = cabinClass
      q.adults = adults
      q.children = children
    })

    // Execute queries
    let skipped = 0
    console.log(`Searching ${days} days of award inventory (${startDate.format('L')} - ${endDate.format('L')})`)
    for (const query of queries) {
      if (await canSkip(query, db)) {
        skipped++
        continue
      }

      try {
        const basePath = pathForQuery(query)
        query.htmlFile = basePath + '.html'
        query.screenshot = basePath + '.jpg'
        if (await engine.search(query)) {
          // Write to database
          const row = {...query}
          row.engine = 'SQ'
          row.departDate = row.departDate ? row.departDate.format('YYYY-MM-DD') : null
          row.returnDate = row.returnDate ? row.returnDate.format('YYYY-MM-DD') : null
          const fields = [
            'engine', 'fromCity', 'toCity',
            'cabinClass', 'departDate', 'returnDate',
            'adults', 'children', 'htmlFile'
          ]
          await insertRow(db, 'awards_requests', row, fields)
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
    await saveCookies(db, await engine.getCookies())
  } catch (e) {
    throw e
  } finally {
    // Cleanup
    if (engine) {
      await engine.close()
    }
    if (db) {
      await db.close()
    }
  }
}

main()
