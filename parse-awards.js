const fs = require('fs')
const minimist = require('minimist')
const path = require('path')
const moment = require('moment')
const sqlite = require('sqlite')

const SQParser = require('./airlines/sq/parser')
const consts = require('./lib/consts')
const { insertRow } = require('./lib/db')
const { printRoute } = require('./lib/utils')

const USAGE = `
Usage: parse-awards.js [OPTIONS]

  Parse search requests from the database to generate award inventory.

Options:
  -v, --verbose         Verbose logging
  -r, --retain          Do not delete failed search requests from database
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
  let numRequests = 0, numAwards = 0

  // Parse arguments
  const argv = minimist(process.argv, {boolean: ['v', 'verbose', 'r', 'retain']})
  if (['help', '?', '?'].find(x => x in argv)) {
    console.log(USAGE)
    return
  }
  let verbose = argv['v'] || argv['verbose']
  let retain = argv['r'] || argv['retain']

  try {
    // Open the database
    console.log('Opening database...')
    const db = await sqlite.open(consts.DB_PATH, { Promise })

    // Clear the awards table
    console.log('Clearing old awards...')
    await db.run('DELETE FROM awards')

    // Iterate over awards requests
    console.log('Parsing search requests...')
    for (const row of await db.all('SELECT * FROM awards_requests')) {
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
        if (retain) {
          continue
        }

        // Remove the faulty request's HTML and screenshot files
        const { htmlFile } = row
        const screenshot = htmlFile.replace('.html', '.jpg')
        if (fs.existsSync(screenshot)) {
          fs.unlinkSync(screenshot)
        }
        if (fs.existsSync(htmlFile)) {
          fs.unlinkSync(htmlFile)
        }

        // Remove from the database
        await db.run('DELETE FROM awards_requests WHERE id = ?', row.id)
        continue
      }

      // Update the database
      for (const award of awards) {
        const { fromCity, toCity, date, flight, aircraft, fareCodes} = award
        numAwards++

        // Print the awards out
        if (verbose && fareCodes) {
          console.log(`  [${fromCity} -> ${toCity}] - ${date} ${flight} (${aircraft}): ${fareCodes}`)
        }

        // Update the awards table
        await insertRow(db, 'awards', award)
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
