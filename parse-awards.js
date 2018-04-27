const fs = require('fs')
const path = require('path')
const moment = require('moment')
const sqlite = require('sqlite')

const SQParser = require('./parsers/sq')
const consts = require('./lib/consts')
const { insertRow } = require('./lib/db')

const main = async () => {
  try {
    // Open the database
    const db = await sqlite.open(consts.DB_PATH, { Promise })

    // Clear the awards table
    await db.run('DELETE FROM awards')

    // Iterate over awards requests
    for (const row of await db.all('SELECT * FROM awards_requests')) {
      const {
        fromCity,
        toCity,
        cabinClass,
        departDate,
        returnDate,
        htmlFile
      } = row

      if (!fs.existsSync(htmlFile)) {
        throw new Error('Could not find file:' + htmlFile)
      }

      // Parse the HTML content from the request
      const awards = SQParser(fs.readFileSync(htmlFile), row)

      // Update the database
      for (const award of awards) {
        if (award.fareCodes) {
          console.log(`[${award.fromCity} -> ${award.toCity}] - ${award.date} ${award.flight} (${award.aircraft}): ${award.fareCodes}`)
        }
        await insertRow(db, 'awards', award)
      }
    }

    await db.close()
  } catch (e) {
    console.error(e)
  }
}

main()
