const program = require('commander')
const fs = require('fs')
const path = require('path')

const fp = require('../src')
const db = require('../shared/db')
const paths = require('../shared/paths')
const utils = require('../shared/utils')

program
  .option('-y, --yes', 'Automatically execute cleanup without confirmation')
  .option('-v, --verbose', 'Verbose logging')
  .parse(process.argv)

async function cleanupRequests (yes, verbose) {
  console.log('Scanning search requests...')
  const requests = []
  const associatedFiles = new Set()
  await db.db().each('SELECT * FROM awards_requests', (err, row) => {
    if (err) {
      throw new Error('Could nto scan search requests: ' + err)
    }

    // Check for any missing resources
    const { htmlFile, fileCount } = row
    let missing = false
    for (let index = 0; index < fileCount; index++) {
      let filename = htmlFile
      if (index > 0) {
        filename = utils.appendPath(htmlFile, '-' + index)
      }
      if (!fs.existsSync(filename)) {
        missing = true
      }

      // Keep track of every file associated with a request
      associatedFiles.add(filename)
      associatedFiles.add(utils.changeExtension(filename, '.jpg'))
    }

    // If any files were missing, cleanup the request
    if (missing) {
      requests.push(row)
      if (verbose) {
        console.log(JSON.stringify(row, null, 4))
      }
    }
  })

  // Check what we found
  if (requests.length === 0) {
    console.log('No incomplete requests were found!')
    return { requests, associatedFiles }
  }

  // Prompt user to cleanup requests
  if (yes || utils.promptYesNo(`Found ${requests.length} incomplete requests. Delete them from the database?`)) {
    console.log('Cleaning up database entries and associated resources...')
    for (const row of requests) {
      await utils.cleanupRequest(row)
    }
    return { requests, associatedFiles }
  }
  return { requests: [], associatedFiles }
}

async function cleanupResources (yes, verbose, associatedFiles) {
  // Iterate over resources
  console.log('Scanning data resources...')
  let resources = fs.readdirSync(paths.data)

  // Ignore hidden files
  resources = resources.filter(x => !x.startsWith('.'))

  // Make paths relative from main directory
  resources = resources.map(x => path.join(paths.data, x))

  // Get the list of files which are not associated with a request
  resources = resources.filter(x => !associatedFiles.has(x))

  // Print orphaned resources if verbose
  if (verbose) {
    resources.forEach(x => console.log('    ' + x))
  }

  // Check what we found
  if (resources.length === 0) {
    console.log('No orphaned resources were found!')
    return { resources }
  }

  // Prompt user to cleanup resources
  if (yes || utils.promptYesNo(`Found ${resources.length} orphaned resources. Delete them from disk?`)) {
    console.log('Cleaning up orphaned resources...')
    for (const filename of resources) {
      if (fs.existsSync(filename)) {
        fs.unlinkSync(filename)
      }
    }
    return { resources }
  }
  return { resources: [] }
}

const main = async (args) => {
  const { yes, verbose } = args

  try {
    // Open the database
    console.log('Opening database...')
    await db.open()

    // Cleanup requests
    const { requests, associatedFiles } = await cleanupRequests(yes, verbose)

    // Cleanup resources
    const { resources } = await cleanupResources(yes, verbose, associatedFiles)

    // Print summary
    console.log('')
    console.log('Cleanup Report:')
    console.log('    Deleted Requests: ' + requests.length)
    console.log('    Deleted Resources: ' + resources.length)
  } catch (e) {
    console.error(e)
    process.exit(1)
  } finally {
    await db.close()
  }
}

main(program)
