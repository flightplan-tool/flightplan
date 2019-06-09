const program = require('commander')
const fs = require('fs')
const prompt = require('syncprompt')
const timetable = require('timetable-fns')

const fp = require('../src')
const accounts = require('../shared/accounts')
const db = require('../shared/db')
const helpers = require('../shared/helpers')
const logger = require('../shared/logger')
const paths = require('../shared/paths')
const routes = require('../shared/routes')

program
  .option('-w, --website <airline>', 'IATA 2-letter code of the airline whose website to search')
  .option('-p, --partners', `Include partner awards (default: false)`)
  .option('-f, --from <city>', `IATA 3-letter code of the departure airport`)
  .option('-t, --to <city>', `IATA 3-letter code of the arrival airport`)
  .option('-o, --oneway', `Searches for one-way award inventory only (default: search both directions)`)
  .option('-c, --cabin <class>', `Cabin (${Object.keys(fp.cabins).join(', ')})`, (x) => (x in fp.cabins) ? x : false, undefined)
  .option('-s, --start <date>', `Starting date of the search range (YYYY-MM-DD)`, undefined)
  .option('-e, --end <date>', `Ending date of the search range (YYYY-MM-DD)`, undefined)
  .option('-q, --quantity <n>', `# of passengers traveling`, (x) => parseInt(x), 1)
  .option('-a, --account <n>', `Index of account to use`, (x) => parseInt(x), 0)
  .option('-h, --headless', `Run Chrome in headless mode`)
  .option('-p, --proxy <server>', `Provide a proxy to use with Chome (server:port:user:pass)`)
  .option('-d, --docker', `Enable flags to make allow execution in docker environment`)
  .option('-P, --no-parser', `Do not parse search results`)
  .option('-r, --reverse', `Run queries in reverse chronological order`)
  .option('--terminate <n>', `Terminate search if no results are found for n successive days`, (x) => parseInt(x), 0)
  .option('--force', 'Re-run queries, even if already in the database')
  .option('--debug [port]', 'Enable remote debugging port for headless Chrome (default: port 9222)', (x) => parseInt(x))
  .on('--help', () => {
    console.log('')
    console.log('  Supported Websites:')
    console.log('')
    fp.supported().forEach(id => console.log(`    ${id} - ${fp.new(id).config.name}`))
  })
  .parse(process.argv)

// Engine-specific search strategies
const strategies = {
  cx: { roundtripOptimized: false },
  ke: { oneWaySupported: false },
  nh: { roundtripOptimized: false }
}

function fatal (engine, message, err) {
  if (typeof engine === 'string') {
    err = message
    message = engine
    engine = null
  }
  engine ? engine.error(message) : logger.error(message)
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
    args.start = prompt('Start date of search range (YYYY-MM-DD)? ')
  }
  if (!args.end) {
    args.end = prompt('End date of search range (YYYY-MM-DD)? ')
  }
  args.partners = !!args.partners
  args.oneway = !!args.oneway
  args.headless = !!args.headless
  args.docker = !!args.docker
  args.parser = !!args.parser
  args.force = !!args.force
  args.debug = (args.debug === true) ? 9222 : args.debug
}

function validateArguments (args) {
  // Validate arguments
  if (!fp.supported(args.website || '')) {
    fatal(`Unsupported airline website to search: ${args.website}`)
  }
  if (!(args.cabin in fp.cabins)) {
    fatal(`Unrecognized cabin specified: ${args.cabin}`)
  }
  if (!timetable.valid(args.start)) {
    fatal(`Invalid start date: ${args.start}`)
  }
  if (!timetable.valid(args.end)) {
    fatal(`Invalid end date: ${args.end}`)
  }
  if (args.end < args.start) {
    fatal(`Invalid date range: ${args.start} - ${args.end}`)
  }
  if (args.quantity < 1) {
    fatal(`Invalid quantity: ${args.quantity}`)
  }
  if (args.account < 0) {
    fatal(`Invalid account index: ${args.account}`)
  }
  if (args.terminate < 0) {
    fatal(`Invalid termination setting: ${args.terminate}`)
  }

  // Instantiate engine, and do further validation
  const engine = fp.new(args.website)
  const { config } = engine

  // Calculate the valid range allowed by the engine
  const { minDays, maxDays } = config.validation
  const [a, b] = config.validDateRange()

  // Check if our search range is completely outside the valid range
  if (args.end < a || args.start > b) {
    fatal(engine, `Can only search within the range: ${a} - ${b}`)
  }

  // If only start or end are outside the valid range, we can adjust them
  if (args.start < a) {
    engine.warn(`Can only search from ${minDays} day(s) from today, adjusting start of search range to: ${a}`)
    args.start = a
  }
  if (args.end > b) {
    engine.warn(`Can only search up to ${maxDays} day(s) from today, adjusting end of search range to: ${b}`)
    args.end = b
  }

  // Parse proxy
  if (args.proxy) {
    const arr = args.proxy.split(':')
    if (arr.length === 0 || arr.length > 4) {
      fatal(`Unrecognized proxy format: ${args.proxy}`)
    }
    if (arr.length <= 2) {
      args.proxy = { server: arr.join(':') }
    } else {
      const [ user, pass ] = arr.splice(-2)
      args.proxy = { server: arr.join(':'), user, pass }
    }
  }
}

function generateQueries (args, engine, days) {
  const { start: startDate, end: endDate } = args
  const queries = []

  // Get search strategy based on engine
  const {
    roundtripOptimized = true,
    oneWaySupported = true,
    tripMinDays = 3
  } = strategies[engine.id.toLowerCase()] || {}
  const gap = (args.oneway || !roundtripOptimized) ? 0 : Math.min(tripMinDays, days)
  const validEnd = engine.config.validDateRange()[1]

  // Compute cities coming from, and to
  const departCities = { fromCity: args.from, toCity: args.to }
  const returnCities = { fromCity: args.to, toCity: args.from }

  // Compute the one-way segments coming back at beginning of search range
  for (let i = 0; i < gap; i++) {
    const date = timetable.plus(startDate, i)
    if (oneWaySupported) {
      queries.push({
        ...returnCities,
        departDate: date,
        returnDate: null
      })
    } else if (timetable.plus(date, tripMinDays) <= validEnd) {
      queries.push({
        ...returnCities,
        departDate: date,
        returnDate: timetable.plus(date, tripMinDays)
      })
    } else {
      queries.push({
        ...departCities,
        departDate: timetable.minus(date, tripMinDays),
        returnDate: date
      })
    }
  }

  // Compute segments in middle of search range
  for (let i = 0; i < days - gap; i++) {
    const date = timetable.plus(startDate, i)
    if (roundtripOptimized) {
      queries.push({
        ...departCities,
        departDate: date,
        returnDate: args.oneway ? null : timetable.plus(date, gap)
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
    const date = timetable.minus(endDate, i)
    if (oneWaySupported) {
      queries.push({
        ...departCities,
        departDate: date,
        returnDate: null
      })
    } else if (timetable.plus(date, tripMinDays) <= validEnd) {
      queries.push({
        ...departCities,
        departDate: date,
        returnDate: timetable.plus(date, tripMinDays)
      })
    } else {
      queries.push({
        ...returnCities,
        departDate: timetable.minus(date, tripMinDays),
        returnDate: date
      })
    }
  }

  // Fill in info that's universal for each query
  queries.forEach(q => {
    q.engine = engine.id
    q.partners = args.partners
    q.cabin = args.cabin
    q.quantity = args.quantity
    const routePath = routes.path(q)
    q.json = { path: routePath + '.json', gzip: true }
    q.html = { path: routePath + '.html', gzip: true }
    q.screenshot = { path: routePath + '.jpg', enabled: true }
  })

  return args.reverse ? queries.reverse() : queries
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
    if (routeMap.awards.find(x => x.segments && x.fares === '' && x.quantity <= quantity)) {
      return true // We already know this segment has no availability for an equal or lesser quantity
    }
  }
  return false
}

const main = async (args) => {
  const {
    start: startDate,
    end: endDate,
    headless,
    proxy,
    docker,
    parser: parse,
    terminate,
    debug: debugPort
  } = args

  // Create engine
  const engine = fp.new(args.website)
  let initialized = false

  try {
    // Create data path if necessary
    if (!fs.existsSync(paths.data)) {
      fs.mkdirSync(paths.data)
    }

    // Create database if necessary, and then open
    db.migrate()
    db.open()

    // Setup engine options
    const options = { headless, proxy, docker }
    if (debugPort) {
      options.args = [ `--remote-debugging-port=${debugPort}` ]
    }

    // Generate queries
    const days = timetable.diff(startDate, endDate) + 1
    const queries = generateQueries(args, engine, days)

    // Execute queries
    let skipped = 0
    let daysRemaining = terminate
    let lastDate = null
    console.log(`Searching ${days} days of award inventory: ${timetable.format(startDate)} - ${timetable.format(endDate)}`)
    for (const query of queries) {
      const { id, loginRequired } = engine

      // Check if the query's results are already stored
      if (!args.force && await redundant(query)) {
        skipped++
        continue
      }

      // Should we terminate?
      if (terminate && parse && query.departDate !== lastDate) {
        daysRemaining--
        lastDate = query.departDate
        if (daysRemaining < 0) {
          console.log(`Terminating search after no award inventory found for ${terminate} days.`)
        }
      }

      // Lazy load the search engine
      if (!initialized) {
        const credentials = loginRequired
          ? accounts.getCredentials(id, args.account) : null
        await engine.initialize({ ...options, credentials })
        initialized = true
      }

      // Print route(s) being searched
      routes.print(query)

      // Run the search query, then check for searcher errors
      let results
      try {
        results = await engine.search(query)
        if (!results.ok) {
          continue
        }
      } catch (err) {
        engine.error('Unexpected error occurred while searching!')
        console.error(err)
        continue
      }

      // Parse awards, then check for parser errors
      let awards
      if (parse) {
        try {
          awards = results.awards
          if (!results.ok) {
            engine.error(`Could not parse awards: ${results.error}`)
            continue
          }
          engine.success(`Found: ${awards.length} awards, ${results.flights.length} flights`)
        } catch (err) {
          engine.error('Unexpected error occurred while parsing!')
          console.error(err)
          continue
        }
      }

      // Write request and awards (if parsed) to database
      const requestId = helpers.saveRequest(results)
      if (awards) {
        if (awards.length > 0) {
          daysRemaining = terminate // Reset termination counter
        }
        const placeholders = helpers.createPlaceholders(results, { cabins: Object.values(fp.cabins) })
        helpers.saveAwards(requestId, awards, placeholders, query)
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
