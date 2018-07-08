const program = require('commander')

const fp = require('../src')
const db = require('../shared/db')

program
  .option('-w, --website <airline>', 'Limit parsing to the specified airline (IATA 2-letter code)')
  .parse(process.argv)

function filter (sql, engine) {
  return engine ? [sql + ' WHERE engine = ?', engine] : [sql]
}

function increment (map, arr) {
  const key = arr.join('|')
  const oldVal = map.get(key) || 0
  map.set(key, oldVal + 1)
}

const main = async (args) => {
  const { website } = args

  try {
    // Open the database
    console.log('Opening database...')
    await db.open()

    // Iterate over search requests
    console.log('Analyzing search requests...')
    const stats = new Map()
    await db.db().each(...filter('SELECT * FROM awards_requests', website), (err, row) => {
      if (err) {
        throw new Error('Could not scan search requests: ' + err)
      }

      const { engine, fromCity, toCity, returnDate, cabin, quantity } = row
      increment(stats, [ engine, fromCity, toCity, cabin, quantity ])
      if (returnDate) {
        increment(stats, [ engine, toCity, fromCity, cabin, quantity ])
      }
    })

    // Print out the stats
    let lastEngine = null
    for (const key of [...stats.keys()].sort()) {
      const [ engine, fromCity, toCity, cabin, quantity ] = key.split('|')
      if (engine !== lastEngine) {
        console.log(`${engine}:`)
        lastEngine = engine
      }
      console.log(`  ${fromCity} => ${toCity} (${cabin}, ${quantity}x): ${stats.get(key)}`)
    }
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
