const program = require('commander')

const fp = require('../src')
const db = require('../shared/db')
const helpers = require('../shared/helpers')
const logger = require('../shared/logger')
const routes = require('../shared/routes')
const utils = require('../shared/utils')

program
  .option('-w, --website <airline>', 'Limit parsing to the specified airline (IATA 2-letter code)')
  .option('-v, --verbose', 'Verbose logging')
  .option('-y, --yes', 'Automatically confirm deletion of failed requests')
  .option('--force', 'Re-parse requests, even if they have already been parsed previously')
  .parse(process.argv)

function getRequests (engine, force) {
  const bind = []

  // Select only those requests without corresponding entries in awards table
  let sql = force
    ? 'SELECT * FROM requests'
    : 'SELECT requests.* FROM requests LEFT JOIN awards ON requests.id = awards.requestId WHERE requestId IS NULL'
  if (engine) {
    sql += `${force ? ' WHERE' : ' AND'} requests.engine = ?`
    bind.push(engine)
  }

  // Evaluate the SQL
  return db.db().prepare(sql).all(...bind)
}

const main = async (args) => {
  const { verbose, yes, force } = args
  let numRequests = 0
  let numAwards = 0
  const parsers = new Map()

  try {
    // Open the database
    console.log('Opening database...')
    db.open()

    // Iterate over search requests
    console.log('Parsing search requests...')
    const failed = []
    for (const row of getRequests(args.website, force)) {
      // First delete all awards associated with this request
      const oldAwards = db.db().prepare('SELECT id FROM awards WHERE requestId = ?').all(row.id)
      helpers.cleanupAwards(oldAwards)

      // Create the parser if necessary
      const { engine } = row
      if (!parsers.has(engine)) {
        parsers.set(engine, fp.new(engine))
      }
      const parser = parsers.get(engine)

      // Load all the request's resources
      const request = helpers.loadRequest(row)

      // Process the request
      numRequests++
      const { awards, error } = parser.parse(request)

      // Print the route
      if (verbose || error) {
        routes.print(row)
      }

      // Handle errors by cleaning up the request
      if (error) {
        logger.error('Error:', error)
        failed.push(row)
        continue
      }

      // Print the award fares for this route
      if (verbose) {
        for (const award of awards) {
          const { fromCity, toCity, date, fares, mileage } = award
          const segments = award.segments.map(x => x.flight).join('-')
          console.log(`    [${fromCity} -> ${toCity}] - ${date} ${segments} (${mileage} Miles): ${fares}`)
        }
      }

      // Update the database
      helpers.addPlaceholders({ ...request, awards }, { cabins: Object.values(fp.cabins) })
      helpers.saveAwards(row.id, awards)
      numAwards += awards.length
    }

    if (failed.length > 0) {
      if (yes || utils.promptYesNo(`${failed.length} failed requests will be purged from the database. Do you want to continue?`)) {
        console.log('Cleaning up stored files and database entries...')
        for (const row of failed) {
          await helpers.cleanupRequest(row)
        }
      }
    }

    console.log(`Search requests processed: ${numRequests}`)
    console.log(`Total awards found: ${numAwards}`)
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
