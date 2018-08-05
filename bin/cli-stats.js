const program = require('commander')
const chalk = require('chalk')

const fp = require('../src')
const db = require('../shared/db')
const logger = require('../shared/logger')

program
  .option('-w, --website <airline>', 'Limit parsing to the specified airline (IATA 2-letter code)')
  .parse(process.argv)

function getRows (table, engine) {
  const bind = []
  let sql = `SELECT * FROM ${table}`
  if (engine) {
    sql += ' WHERE engine = ?'
    bind.push(engine)
  }
  return db.db().prepare(sql).all(...bind)
}

function processRows (type, routes, engine) {
  const rows = getRows(type, engine)
  for (const row of rows) {
    const { fromCity, toCity, returnDate } = row
    store(row, type, routes, fromCity, toCity)
    if (returnDate) {
      store(row, type, routes, toCity, fromCity)
    }
  }
  return rows.length
}

function store (row, type, routes, fromCity, toCity) {
  const key = `${fromCity}-${toCity}`
  let val = routes.get(key)
  if (!val) {
    val = { requests: [], awards: [] }
    routes.set(key, val)
  }
  val[type].push(row)
}

const cabinOrder = [fp.cabins.economy, fp.cabins.premium, fp.cabins.business, fp.cabins.first]

function increment (counts, request, index) {
  // Create the grouping key
  const { engine, cabin, quantity, partners } = request
  const key = [ engine, cabinOrder.indexOf(cabin), quantity, partners ? 1 : 0 ].join('|')
  let val = counts.get(key)
  if (!val) {
    val = [ 0, 0, request ]
    counts.set(key, val)
  }
  val[index]++
}

const main = async (args) => {
  const { website } = args

  try {
    // Open the database
    console.log('Opening database...')
    db.open()

    // Iterate over requests and awards
    const routes = new Map()
    console.log('Analyzing requests table...')
    const numRequests = processRows('requests', routes, website)
    console.log('Analyzing awards table...')
    const numAwards = processRows('awards', routes, website)

    // Present stats
    console.log('')
    for (const [route, { requests, awards }] of routes) {
      console.log(chalk.bold(chalk.green(`${route}:`)))

      // Create a map of requests by ID
      const requestById = new Map()
      requests.forEach(x => requestById.set(x.id, x))

      // Group by [ engine, cabin, quantity, partners ]
      const counts = new Map()
      for (const request of requests) {
        increment(counts, request, 0)
      }
      for (const award of awards) {
        const request = requestById.get(award.requestId)
        if (request) {
          increment(counts, request, 1)
        }
      }

      // Sort counts by key, and print them
      for (const key of [...counts.keys()].sort()) {
        const [ numRequests, numAwards, request ] = counts.get(key)
        const { engine, cabin, quantity, partners } = request
        console.log(
          chalk.blue(`  ${engine} [${cabin}, ${quantity}x]${partners ? ' (P)' : ''}:`) +
          ` ${numRequests} requests, ${numAwards} awards`
        )
      }
    }

    // Print totals
    console.log('')
    console.log(chalk.bold(chalk.green('Totals:')))
    const unique = new Set([...routes.keys()].map(x => x.split('-').sort().join('-')))
    console.log(`  ${routes.size} routes (${unique.size} unique)`)
    console.log(`  ${numRequests} requests`)
    console.log(`  ${numAwards} awards`)
  } catch (err) {
    logger.error(err.message)
    console.error(err)
    process.exit(1)
  } finally {
    db.close()
  }
}

// Validate arguments
if (!fp.supported(program.website)) {
  logger.error(`Unsupported airline website to parse: ${program.website}`)
  process.exit(1)
}
main(program)
