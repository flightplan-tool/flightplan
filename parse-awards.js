const fs = require('fs')
const minimist = require('minimist')

const SQParser = require('./airlines/sq/parser')
const db = require('./lib/db')
const { printRoute, promptYesNo } = require('./lib/utils')

const USAGE = `
Usage: parse-awards.js [OPTIONS]

  Parse search requests from the database to generate award inventory.

Options:
  -v, --verbose       Verbose logging.
  -y, --yes           Automatically confirm deletion of failed requests.
`

function parseRequest (request) {
  const { htmlFile } = request
  if (!fs.existsSync(htmlFile)) {
    return { error: `Request is missing HTML file: ${htmlFile}` }
  }

  // Parse the HTML content from the request
  return SQParser(fs.readFileSync(htmlFile), request)
}

const main = async () => {
  let numRequests = 0
  let numAwards = 0

  // Parse arguments
  const argv = minimist(process.argv, {boolean: ['v', 'verbose', 'y', 'yes']})
  if (['help', '?', '?'].find(x => x in argv)) {
    console.log(USAGE)
    return
  }
  let verbose = argv['v'] || argv['verbose']
  let yes = argv['y'] || argv['yes']

  try {
    // Open the database
    console.log('Opening database...')
    const _db = await db.open()

    // Clear the awards table
    console.log('Clearing old awards...')
    await _db.run('DELETE FROM awards')

    // Iterate over awards requests
    console.log('Parsing search requests...')
    const failed = []
    for (const row of await _db.all('SELECT * FROM awards_requests')) {
      numRequests++

      // Process the request
      const { error, awards } = parseRequest(row)

      // Print the route
      if (verbose || error) {
        printRoute(row)
      }

      // Handle errors by cleaning up the request
      if (error) {
        console.log(`    [ERROR] ${error}`)
        const { id, htmlFile } = row
        failed.push({ id, htmlFile })
        continue
      }

      // Update the database
      for (const award of awards) {
        const { fromCity, toCity, date, flight, aircraft, fares } = award
        numAwards++

        // Print the awards out
        if (verbose && fares) {
          console.log(`  [${fromCity} -> ${toCity}] - ${date} ${flight} (${aircraft}): ${fares}`)
        }

        // Update the awards table
        await db.insertRow('awards', award)
      }
    }

    if (failed.length > 0) {
      yes = yes || promptYesNo(`${failed.length} failed requests will be purged from the database. Do you want to continue?`)
      if (yes) {
        console.log('Cleaning up stored files and database entries...')
        for (const row of failed) {
          const { id, htmlFile } = row

          // Remove the faulty request's HTML and screenshot files
          const screenshot = htmlFile.replace('.html', '.jpg')
          if (fs.existsSync(screenshot)) {
            fs.unlinkSync(screenshot)
          }
          if (fs.existsSync(htmlFile)) {
            fs.unlinkSync(htmlFile)
          }

          // Remove from the database
          await _db.run('DELETE FROM awards_requests WHERE id = ?', id)
        }
      }
    }

    console.log(`Search requests processed: ${numRequests}`)
    console.log(`Total awards found: ${numAwards}`)

    await db.close()
  } catch (e) {
    console.error(e)
  }
}

main()
