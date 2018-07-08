const program = require('commander')
const fs = require('fs')
const path = require('path')
const sqlite = require('sqlite')

const db = require('../shared/db')
const paths = require('../shared/paths')
const utils = require('../shared/utils')

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
  const assets = utils.assetsForRequest(request)
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
      console.error(`Import directory does not exist: ${path.resolve(program.directory)}`)
      return
    }
    if (!fs.existsSync(dataPath)) {
      console.error(`Import directory is missing "data" subdirectory: ${path.resolve(dataPath)}`)
      return
    }
    if (!fs.existsSync(dbPath)) {
      console.error(`Import directory is missing database: ${path.resolve(dbPath)}`)
      return
    }

    // Open destination database
    console.log('Opening source and destination databases...')
    const fromDB = await sqlite.open(dbPath, { Promise })
    await db.open()

    // Create set of existing resources, so we don't add duplicate requests
    console.log('Checking existing resources...')
    const existing = new Set()
    await db.db().each('SELECT * FROM awards_requests', (err, row) => {
      if (err) {
        throw new Error('Could not scan search requests: ' + err)
      }

      existing.add(row.htmlFile)
    })

    // Check how many routes / awards will be added
    const requestCount = await count(fromDB, 'awards_requests')
    const awardCount = await count(fromDB, 'awards')
    let duplicates = 0

    // Prompt user to import requests
    if (yes || utils.promptYesNo(`Import ${requestCount} requests and ${awardCount} awards?`)) {
      console.log(`Importing ${requestCount} requests...`)
      await fromDB.each('SELECT * FROM awards_requests', (err, row) => {
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
        db.insertRow('awards_requests', row)

        // Copy assets from import directory
        copyAssets(row, directory, verbose)
      })

      console.log(`Importing ${awardCount} awards...`)
      const rows = await fromDB.all('SELECT * FROM awards')
      for (const row of rows) {
        if (verbose) {
          console.log(JSON.stringify(row, null, 4))
        }

        // Insert the request into the database
        delete row.id
        await db.insertRow('awards', row)
      }
    }

    console.log(`Import complete. Skipped ${duplicates} duplicate requests.`)
  } catch (e) {
    console.error(e)
    process.exit(1)
  } finally {
    if (fromDB) {
      await fromDB.close()
    }
    await db.close()
  }
}

// Validate arguments
if (!program.directory) {
  program.help()
}
main(program)
