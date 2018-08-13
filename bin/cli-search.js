const program = require('commander')
const fs = require('fs')
const moment = require('moment')
const prompt = require('syncprompt')
const sleep = require('await-sleep')

const fp = require('../src')
const accounts = require('../shared/accounts')
const db = require('../shared/db')
const logger = require('../shared/logger')
const paths = require('../shared/paths')
const routes = require('../shared/routes')
const utils = require('../shared/utils')

program
  .option('-w, --website <airline>', 'IATA 2-letter code of the airline whose website to search')
  .option('-p, --partners', `Include partner awards (default: false)`)
  .option('-f, --from <city>', `IATA 3-letter code of the departure airport`)
  .option('-t, --to <city>', `IATA 3-letter code of the arrival airport`)
  .option('-o, --oneway', `Searches for one-way award inventory only (default: search both directions)`)
  .option('-c, --cabin <class>', `Cabin (${Object.keys(fp.cabins).join(', ')})`, (x) => (x in fp.cabins) ? x : false, undefined)
  .option('-s, --start <date>', `Starting date of the search range (YYYY-MM-DD)`, (x) => parseDate(x), undefined)
  .option('-e, --end <date>', `Ending date of the search range (YYYY-MM-DD)`, (x) => parseDate(x), undefined)
  .option('-q, --quantity <n>', `# of passengers traveling`, (x) => parseInt(x), 1)
  .option('-a, --account <n>', `Index of account to use`, (x) => parseInt(x), 0)
  .option('-h, --headless', `Run Chrome in headless mode`)
  .option('-P, --no-parser', `Do not parse search results`)
  .option('--force', 'Re-run queries, even if already in the database')
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

function fatal (message, err) {
  logger.error(message)
  if (err) {
    console.error(err)
  }
  process.exit(1)
}

function populateArguments (args) {
  // Default to one-day search if end date is not specified
  if (args.start && !args.end) {
    args.end = args.start
  }

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
    args.cabin = prompt(`Desired cabin class (${Object.keys(fp.cabins).join('/')})? `)
  }
  if (!args.start) {
    args.start = parseDate(prompt('Start date of search range (YYYY-MM-DD)? '))
  }
  if (!args.end) {
    args.end = parseDate(prompt('End date of search range (YYYY-MM-DD)? '))
  }
  args.partners = !!args.partners
  args.oneway = !!args.oneway
  args.headless = !!args.headless
  args.parser = !!args.parser
  args.force = !!args.force
}

function validateArguments (args) {
  // Validate arguments
  if (!fp.supported(args.website)) {
    fatal(`Unsupported airline website to search: ${args.website}`)
  }
  if (!(args.cabin in fp.cabins)) {
    fatal(`Unrecognized cabin specified: ${args.cabin}`)
  }
  if (!args.start) {
    fatal(`Invalid start date: ${args.start}`)
  }
  if (!args.end) {
    fatal(`Invalid end date: ${args.end}`)
  }
  if (args.end.isBefore(args.start)) {
    fatal(`Invalid date range: ${args.start} - ${args.end}`)
  }

  // Instantiate engine, and do further validation
  const engine = fp.new(args.website)
  const { id, website } = engine.config

  // Calculate the valid range allowed by the engine
  const { minDays, maxDays } = engine.config.validation
  const [a, b] = engine.validDateRange()

  // Check if our search range is completely outside the valid range
  if (args.end.isBefore(a, 'd') || args.start.isAfter(b, 'd')) {
    fatal(`${website} (${id}) only supports searching within the range: ${a.format('L')} - ${b.format('L')}`)
  }

  // If only start or end are outside the valid range, we can adjust them
  if (args.start.isBefore(a, 'd')) {
    logger.warn(`${website} (${id}) can only search from ${minDays} day(s) from today, adjusting start of search range to: ${a.format('L')}`)
    args.start = a
  }
  if (args.end.isAfter(b, 'd')) {
    logger.warn(`${website} (${id}) can only search up to ${maxDays} day(s) from today, adjusting end of search range to: ${b.format('L')}`)
    args.end = b
  }
}

function generateQueries (args, engine, days) {
  const { start: startDate, end: endDate } = args
  const { roundtripOptimized = true, tripMinDays = 3, oneWaySupported = true } = engine.config
  const gap = (args.oneway || !roundtripOptimized) ? 0 : Math.min(tripMinDays, days)
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
    } else if (date.clone().add(tripMinDays, 'd').isBefore(validEnd)) {
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
    const date = startDate.clone().add(i, 'd')
    if (roundtripOptimized) {
      queries.push({
        ...departCities,
        departDate: date,
        returnDate: args.oneway ? null : date.clone().add(gap, 'd')
      })
    } else {
      queries.push({...departCities, departDate: date})
      if (!args.oneway) {
        queries.push({...returnCities, departDate: date})
      }
    }
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
    } else if (date.clone().add(tripMinDays, 'd').isBefore(validEnd)) {
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
    q.partners = args.partners
    q.cabin = args.cabin
    q.quantity = args.quantity
    const routePath = routes.path(q)
    q.json = { path: routePath + '.json', gzip: true }
    q.html = { path: routePath + '.html', gzip: true }
    q.screenshot = { path: routePath + '.jpg' }
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

function redundantSegment (routeMap, query) {
  const { quantity } = query
  if (routeMap) {
    if (routeMap.requests.find(x => x.quantity === quantity)) {
      return true // We've already run a request for this segment
    }
    if (routeMap.awards.find(x => x.fares === '' && x.quantity <= quantity)) {
      return true // We already know this segment has no availability for an equal or lesser quantity
    }
  }
  return false
}

const main = async (args) => {
  const { start: startDate, end: endDate, headless, parser: parse } = args

  // Create engine
  const { partners, force } = args
  const engine = fp.new(args.website, { partners })
  let initialized = false

  try {
    // Create data path if necessary
    if (!fs.existsSync(paths.data)) {
      fs.mkdirSync(paths.data)
    }

    // Create database if necessary, and then open
    db.migrate()
    db.open()

    // Generate queries
    const days = endDate.diff(startDate, 'd') + 1
    const queries = generateQueries(args, engine, days)

    // Execute queries
    let skipped = 0
    console.log(`Searching ${days} days of award inventory: ${startDate.format('L')} - ${endDate.format('L')}`)
    for (const query of queries) {
      const { id, loginRequired } = engine.config

      // Check if the query's results are already stored
      if (!force && await redundant(query)) {
        skipped++
        continue
      }

      // Lazy load the search engine
      if (!initialized) {
        const credentials = loginRequired
          ? accounts.getCredentials(id, args.account) : null
        await engine.initialize({ credentials, parse, headless })
        initialized = true
      }

      // Print route(s) being searched
      routes.print(query)

      // Run the search query
      let results
      try {
        results = await engine.search(query)
      } catch (err) {
        engine.error('Unexpected error occurred while searching!')
        console.error(err)
        continue
      }

      // Check for an error
      if (results.error) {
        continue
      }

      // Write request and awards (if parsed) to database
      const requestId = utils.saveRequest(results)
      if (results.awards) {
        utils.addPlaceholders(results, { cabins: Object.values(fp.cabins) })
        utils.saveAwards(requestId, results.awards)
      }

      // Insert a delay if we've been blocked
      if (results.blocked) {
        const delay = utils.randomInt(65, 320)
        engine.warn(`Blocked by server, waiting for ${moment().add(delay, 's').fromNow(true)}`)
        await sleep(delay * 1000)
      }
    }
    if (skipped > 0) {
      console.log(`Skipped ${skipped} queries.`)
    }
    logger.success('Search complete!')
  } catch (err) {
    fatal('A fatal error occurred!', err)
  } finally {
    await engine.close()
    db.close()
  }
}

populateArguments(program)
validateArguments(program)
main(program)