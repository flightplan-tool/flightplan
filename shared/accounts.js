const fs = require('fs')
const parse = require('csv-parse/lib/sync')
const path = require('path')

const paths = require('./paths')
const prompts = require('../shared/prompts')

let accounts = null

function loadAccounts () {
  let credentialsExists = fs.existsSync(paths.credentials)

  // Check if we should convert an old JSON-format version
  if (!credentialsExists && fs.existsSync(paths.oldCredentials)) {
    if (prompts.askYesNo(`
ERROR: An older version of the airline website credentials (JSON-format) was found at "${paths.oldCredentials}"

Would you like to convert it to the newer format?`)) {
      // Load JSON
      const contents = fs.readFileSync(paths.oldCredentials)
      const json = JSON.parse(contents)
      const lines = []
      for (const [key, list] of Object.entries(json)) {
        for (const val of list) {
          const { username, password } = val
          lines.push([ key.toUpperCase(), username, password ].join(':'))
        }
      }

      // Write out new file
      fs.appendFileSync(paths.credentials, lines.sort().join('\n'))
      credentialsExists = true
    }
  }

  // Ask if the user would like us to create the file, from the template
  if (!credentialsExists) {
    if (prompts.askYesNo(`
ERROR: Airline website credentials not found at "${paths.credentials}"

Would you like to create the file?`)) {
      const src = path.resolve(__dirname, '../config/accounts-example.txt')
      const destDir = path.dirname(paths.credentials)
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir)
      }
      fs.copyFileSync(src, paths.credentials)
      console.log(`
The file has been created, using "config/accounts-example.txt" as a template.
Please edit the file, to contain valid account information for the airlines
you're searching.`)
    }
    process.exit(1)
  }

  // Load credentials
  const contents = fs.readFileSync(paths.credentials)
  const rows = parse(contents, { delimiter: ':', relax_column_count: true })

  // Convert rows to map, grouped by engine
  return rows.reduce((map, row) => {
    const key = row[0].toUpperCase()
    if (!map[key]) {
      map[key] = []
    }
    map[key].push(row.slice(1))
    return map
  }, {})
}

function getCredentials (engine, account = 0) {
  if (!accounts) {
    accounts = loadAccounts()
  }
  const list = accounts[engine.toUpperCase()]
  if (!list || list.length === 0) {
    throw new Error(`Missing account information for engine: ${engine}`)
  }
  return list[account % list.length]
}

module.exports = {
  getCredentials
}
