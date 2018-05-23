const program = require('commander')
const fs = require('fs')
const moment = require('moment')
const prompt = require('syncprompt')
const sleep = require('await-sleep')

const fp = require('../src')
const accounts = require('../shared/accounts')
const db = require('../shared/db')
const paths = require('../shared/paths')
const routes = require('../shared/routes')
const utils = require('../shared/utils')

program
  .option('-w, --website <airline>', 'IATA 2-letter code of the airline whose website to search')
  .option('-f, --from <city>', `IATA 3-letter code of the departure airport`)
  .option('-t, --to <city>', `IATA 3-letter code of the arrival airport`)
  .option('-o, --oneway', `Searches for one-way award inventory only (default: search both directions)`)
  .option('-c, --cabin <class>', `Cabin (${Object.keys(fp.cabins).join(', ')})`, (x) => (x in fp.cabins) ? x : false, undefined)
  .option('-s, --start <date>', `Starting date of the search range (YYYY-MM-DD)`, (x) => parseDate(x), undefined)
  .option('-e, --end <date>', `Ending date of the search range (YYYY-MM-DD)`, (x) => parseDate(x), undefined)
  .option('-q, --quantity <n>', `# of passengers traveling`, parseInt, 1)
  .option('-a, --account <n>', `Index of account to use`, parseInt, 0)
  .option('-h, --headless', `Run Chrome in headless mode`)
  .on('--help', () => {
    console.log('')
    console.log('  Supported Websites:')
    console.log('')
    fp.supported().forEach(id => console.log(`    ${id} - ${fp.new(id).config.name}`))
  })
  .parse(process.argv)

function parseDate (strDate) {
  const m = moment(strDate, 'YYYY-MM-DD', true)
  return m.isValid() ? m.startOf('d') : false
}

function populateArguments (args) {
  // Fill in missing arguments
  if (!args.website) {
    args.website = prompt('Airline website to search (2-letter code)? ')
  }
  if (!args.from) {
    args.from = prompt('Departure city (3-letter code)? ')
  }
  if (!args.to) {
    args.to = prompt('Arrival city (3-letter code)? ')
  }
  if (!args.cabin) {
    args.cabin = prompt(`Desired cabin class (${Object.keys(fp.cabins).join('/')}})? `)
  }
  if (!args.start) {
    args.start = parseDate(prompt('Start date of search range (YYYY-MM-DD)? '))
  }
  if (!args.end) {
    args.end = parseDate(prompt('End date of search range (YYYY-MM-DD)? '))
  }
  args.oneway = !!args.oneway
  args.headless = !!args.headless
}

function validateArguments (args) {
  // Validate arguments
  if (!fp.supported(args.website)) {
    return `Unsupported airline website to search: ${args.website}`
  }
  if (!(args.cabin in fp.cabins)) {
    return `Unrecognized cabin specified: ${args.cabin}`
  }
  if (!args.start) {
    return `Invalid start date: ${args.start}`
  }
  if (!args.end) {
    return `Invalid end date: ${args.end}`
  }
  if (args.end.isBefore(args.start)) {
    return `Invalid date range: ${args.start} - ${args.end}`
  }

  // Instantiate engine, and do further validation
  const engine = fp.new(args.website)
  const fares = Object.values(engine.config.fares)
  const cabins = new Set([...fares.map(x => x.cabin)])
  if (!cabins.has(args.cabin)) {
    return `Selected engine (${args.website}) does not support the cabin: ${args.cabin}`
  }
  if (args.oneway && !engine.config.oneWaySupported) {
    return `Selected engine (${args.website}) does not support one-way searches`
  }

  // Calculate the valid range allowed by the engine
  const { minDays, maxDays } = engine.config.validation
  const [a, b] = engine.validDateRange()

  // Check if our search range is completely outside the valid range
  if (args.end.isBefore(a, 'd') || args.start.isAfter(b, 'd')) {
    return `Selected engine (${args.website}) only supports searching within the range: ${a.format('L')} - ${b.format('L')}`
  }

  // If only start or end are outside the valid range, we can adjust them
  if (args.start.isBefore(a, 'd')) {
    console.log(`This method can only search from ${minDays} day(s) from today, adjusting start of search range to: ${a.format('L')}`)
    args.start = a
  }
  if (args.end.isAfter(b, 'd')) {
    console.log(`This method can only search up to ${maxDays} day(s) from today, adjusting end of search range to: ${b.format('L')}`)
    args.end = b
  }
}

function generateQueries (args, engine, days) {
  const { start: startDate, end: endDate } = args
  const { tripMinDays, oneWaySupported } = engine.config
  const gap = args.oneway ? 0 : Math.min(tripMinDays, days)
  const validEnd = engine.validDateRange()[1]
  const queries = []

  // Compute cities coming from, and to
  const departCities = { fromCity: args.from, toCity: args.to }
  const returnCities = { fromCity: args.to, toCity: args.from }

  // Compute the one-way segments coming back at beginning of search range
  for (let i = 0; i < gap; i++) {
    const date = startDate.clone().add(i, 'd')
    if (oneWaySupported) {
      queries.push({
        ...returnCities,
        departDate: date,
        returnDate: null
      })
    } else if (date.add(tripMinDays, 'd').isBefore(validEnd)) {
      queries.push({
        ...returnCities,
        departDate: date,
        returnDate: date.clone().add(tripMinDays, 'd')
      })
    } else {
      queries.push({
        ...departCities,
        departDate: date.clone().subtract(tripMinDays, 'd'),
        returnDate: date
      })
    }
  }

  // Compute segments in middle of search range
  for (let i = 0; i < days - gap; i++) {
    const date = startDate.clone().add(gap + i, 'd')
    queries.push({
      ...departCities,
      departDate: date,
      returnDate: args.oneway ? null : date.clone().add(gap, 'd')
    })
  }

  // Compute the one-way segments going out at end of search range
  for (let i = gap - 1; i >= 0; i--) {
    const date = endDate.clone().subtract(i, 'd')
    if (oneWaySupported) {
      queries.push({
        ...departCities,
        departDate: date,
        returnDate: null
      })
    } else if (date.add(tripMinDays, 'd').isBefore(validEnd)) {
      queries.push({
        ...departCities,
        departDate: date,
        returnDate: date.clone().add(tripMinDays, 'd')
      })
    } else {
      queries.push({
        ...returnCities,
        departDate: date.clone().subtract(tripMinDays, 'd'),
        returnDate: date
      })
    }
  }

  // Fill in info that's universal for each query
  queries.forEach(q => {
    q.engine = engine.config.id
    q.cabin = args.cabin
    q.quantity = args.quantity
    const routePath = routes.path(q)
    q.htmlFile = routePath + '.html.gz'
    q.screenshot = routePath + '.jpg'
  })

  return queries
}

async function redundant (query) {
  const { departDate, returnDate } = query

  // Lookup associated routes from database
  const map = await routes.find(query)

  // Get departures
  const departures = map.get(routes.key(query, departDate))
  const departRedundant = redundantSegment(departures, query)
  if (!departRedundant) {
    return false
  }

  // Check returns
  if (returnDate) {
    const returns = map.get(routes.key(query, returnDate, true))
    const returnRedundant = redundantSegment(returns, query)
    if (!returnRedundant) {
      return false
    }
  }

  return true
}

function redundantSegment (routes, query) {
  const { quantity } = query
  if (routes) {
    if (routes.requests.find(x => x.quantity === quantity)) {
      return true // We've already run a request for this segment
    }
    if (routes.awards.find(x => x.fares === '' && x.quantity <= quantity)) {
      return true // We already know this segment has no availability for an equal or lesser quantity
    }
  }
  return false
}

const main = async (args) => {
  const { start: startDate, end: endDate, headless } = args

  // Create engine
  const engine = fp.new(args.website)
  let initialized = false

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
    const days = endDate.diff(startDate, 'd') + 1
    const queries = generateQueries(args, engine, days)

    // Execute queries
    let skipped = 0
    console.log(`Searching ${days} days of award inventory: ${startDate.format('L')} - ${endDate.format('L')}`)
    for (const query of queries) {
      // Check if the query's results are already stored
      if (await redundant(query)) {
        skipped++
        continue
      }

      // Lazy load the search engine
      if (!initialized) {
        const account = engine.config.loginRequired
          ? accounts.getCredentials(engine.config.id, args.account) : {}
        const ret = await engine.initialize({...account, cookies, headless, timeout: 5 * 60000})
        if (ret && ret.error) {
          engine.error(ret.error)
          process.exit(1)
        }
        initialized = true
      }

      // Print route(s) being searched
      routes.print(query)

      // Run the search query
      const { fileCount, blocked, error } = await engine.search(query)
      if (error) {
        console.error(error)
        continue
      }

      // Insert a delay if we've been blocked
      if (blocked) {
        const delay = utils.randomInt(65, 320)
        console.log(`Blocked by server, waiting for ${moment().add(delay, 's').fromNow(true)}`)
        await sleep(delay * 1000)
      }

      // Write to database
      const row = {...query, fileCount}
      row.departDate = row.departDate ? row.departDate.format('YYYY-MM-DD') : null
      row.returnDate = row.returnDate ? row.returnDate.format('YYYY-MM-DD') : null
      const fields = [
        'engine', 'fromCity', 'toCity', 'departDate', 'returnDate', 'cabin', 'quantity', 'htmlFile', 'fileCount'
      ]
      await db.insertRow('awards_requests', row, fields)
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
    console.error(e)
    process.exit(1)
  } finally {
    await engine.close()
    await db.close()
  }
}

populateArguments(program)
const err = validateArguments(program)
if (err) {
  console.error(err)
  process.exit(1)
}
main(program)
