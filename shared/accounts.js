const fs = require('fs')
const path = require('path')

const paths = require('./paths')
const utils = require('../shared/utils')

let accounts = null

function loadAccounts () {
  if (!fs.existsSync(paths.credentials)) {
    // Ask if the user would like us to create the file, from the template
    if (utils.promptYesNo(`
ERROR: Airline website credentials not found at "${paths.credentials}"

Would you like to create the file?`)) {
      const src = path.resolve(__dirname, '../config/accounts-example.json')
      const destDir = path.dirname(paths.credentials)
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir)
      }
      fs.copyFileSync(src, paths.credentials)
      console.log(`
The file has been created, using "config/accounts-example.json" as a template.
Please edit the file, to contain valid account information for the airlines
you're searching.`)
    }
    process.exit(1)
  }

  // Load JSON
  const contents = fs.readFileSync(paths.credentials)
  const json = JSON.parse(contents)

  // Make sure keys are uppercase
  const ret = {}
  for (const [method, list] of Object.entries(json)) {
    ret[method.toUpperCase()] = list
  }
  return ret
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
