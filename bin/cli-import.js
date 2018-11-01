const program = require('commander')
const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')

const db = require('../shared/db')
const helpers = require('../shared/helpers')
const logger = require('../shared/logger')
const paths = require('../shared/paths')
const prompts = require('../shared/prompts')

program
  .option('-d, --directory <path>', 'Import requests from the provided path (must have "data" and "db" subdirectories)')
  .option('-v, --verbose', 'Verbose logging')
  .option('-y, --yes', 'Automatically confirm importing records')
  .parse(process.argv)

async function count (database, table) {
  const result = await database.get(`SELECT count(*) FROM ${table}`)
  return result ? result['count(*)'] : undefined
}

function copyAssets (request, srcPath, verbose) {
  const assets = helpers.assetsForRequest(request)
  const files = [...assets.htmlFiles, ...assets.screenshots]
  for (const file of files) {
    const src = path.resolve(srcPath, file)
    const dest = path.resolve(file)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest)
    } else if (verbose) {
      console.log(`Asset not found, skipping: ${src}`)
    }
  }
}

const main = async (args) => {
  const { directory, verbose, yes } = args

  let fromDB = null

  try {
    // Establish paths, and ensure everything exists
    const dataPath = path.join(directory, paths.data)
    const dbPath = path.join(directory, paths.database)
    if (!fs.existsSync(directory)) {
      logger.error(`Import directory does not exist: ${path.resolve(program.directory)}`)
      return
    }
    if (!fs.existsSync(dataPath)) {
      logger.error(`Import directory is missing "data" subdirectory: ${path.resolve(dataPath)}`)
      return
    }
    if (!fs.existsSync(dbPath)) {
      logger.error(`Import directory is missing database: ${path.resolve(dbPath)}`)
      return
    }

    // Open destination database
    console.log('Opening source and destination databases...')
    const fromDB = new Database(dbPath)
    db.open()

    // Create set of existing resources, so we don't add duplicate requests
    console.log('Checking existing resources...')
    const existing = new Set()
    db.db().each('SELECT * FROM requests', (err, row) => {
      if (err) {
        throw new Error('Could not scan search requests: ' + err)
      }

      existing.add(row.htmlFile)
    })

    // Check how many routes / awards will be added
    const requestCount = count(fromDB, 'requests')
    const awardCount = count(fromDB, 'awards')
    let duplicates = 0

    // Prompt user to import requests
    if (yes || prompts.askYesNo(`Import ${requestCount} requests and ${awardCount} awards?`)) {
      console.log(`Importing ${requestCount} requests...`)
      fromDB.each('SELECT * FROM requests', (err, row) => {
        if (err) {
          throw new Error('Could not import requests: ' + err)
        }
        if (existing.has(row.htmlFile)) {
          duplicates++
          return
        }
        if (verbose) {
          console.log(JSON.stringify(row, null, 4))
        }

        // Insert the request into the database
        delete row.id
        db.insertRow('requests', row)

        // Copy assets from import directory
        copyAssets(row, directory, verbose)
      })

      console.log(`Importing ${awardCount} awards...`)
      const rows = fromDB.all('SELECT * FROM awards')
      for (const row of rows) {
        if (verbose) {
          console.log(JSON.stringify(row, null, 4))
        }

        // Insert the request into the database
        delete row.id
        db.insertRow('awards', row)
      }
    }

    logger.success(`Import complete. Skipped ${duplicates} duplicate requests.`)
  } catch (err) {
    logger.error(err.message)
    console.error(err)
    process.exit(1)
  } finally {
    if (fromDB) {
      fromDB.close()
    }
    db.close()
  }
}

// Validate arguments
if (!program.directory) {
  program.help()
}
main(program)
