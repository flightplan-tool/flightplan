const program = require('commander')

const fp = require('../src')
const db = require('../shared/db')
const routes = require('../shared/routes')
const utils = require('../shared/utils')

program
  .option('-w, --website <airline>', 'Limit parsing to the specified airline (IATA 2-letter code)')
  .option('-v, --verbose', 'Verbose logging')
  .option('-y, --yes', 'Automatically confirm deletion of failed requests')
  .parse(process.argv)

function filter (sql, engine) {
  return engine ? [sql + ' WHERE engine = ?', engine] : [sql]
}

const main = async (args) => {
  const { verbose, yes } = args
  let numRequests = 0
  let numAwards = 0
  const parsers = new Map()

  try {
    // Open the database
    console.log('Opening database...')
    await db.open()

    // Clear the awards table
    console.log('Clearing old awards...')
    await db.db().run(...filter('DELETE FROM awards', args.website))

    // Iterate over awards requests
    console.log('Parsing search requests...')
    const failed = []
    const rows = await db.db().all(...filter('SELECT * FROM awards_requests', args.website))
    for (const row of rows) {
      // Create the parser if necessary
      const { engine } = row
      if (!parsers.has(engine)) {
        parsers.set(engine, fp.new(engine))
      }
      const parser = parsers.get(engine)

      // Process the request
      numRequests++
      const { awards, error } = parser.parse(row)

      // Print the route
      if (verbose || error) {
        routes.print(row)
      }

      // Handle errors by cleaning up the request
      if (error) {
        console.error(error)
        const { id, htmlFile } = row
        failed.push({ id, htmlFile })
        return
      }

      // Update the database
      for (const award of awards) {
        const { fromCity, toCity, date, flight, aircraft, fares } = award

        // Check if we had any fares
        if (!fares) {
          continue
        }

        // Print the award fares for this segment
        if (verbose && fares) {
          console.log(`  [${fromCity} -> ${toCity}] - ${date} ${flight} (${aircraft}): ${fares}`)
        }
        numAwards++

        // Update the awards table
        await db.insertRow('awards', award)
      }
    }

    if (failed.length > 0) {
      if (yes || utils.promptYesNo(`${failed.length} failed requests will be purged from the database. Do you want to continue?`)) {
        console.log('Cleaning up stored files and database entries...')
        for (const row of failed) {
          await utils.cleanupRequest(row)
        }
      }
    }

    console.log(`Search requests processed: ${numRequests}`)
    console.log(`Total awards found: ${numAwards}`)
  } catch (e) {
    console.error(e)
    process.exit(1)
  } finally {
    await db.close()
  }
}

// Validate arguments
if (!fp.supported(program.website)) {
  console.error(`Unsupported airline website to parse: ${program.website}`)
  process.exit(1)
}
main(program)
