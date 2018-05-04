const fs = require('fs')
const consts = require('./consts')

let accounts = null

function loadAccounts () {
  if (!fs.existsSync(consts.CREDENTIALS_PATH)) {
    console.log(`
ERROR: Airline website credentials not found at "${consts.CREDENTIALS_PATH}"

Please create the file, using "config/accounts-example.json" as a template,
and filling out valid account information for the airlines you're searching.`)
    process.exit(1)
  }

  // Load JSON
  const contents = fs.readFileSync(consts.CREDENTIALS_PATH)
  const json = JSON.parse(contents)

  // Make sure keys are uppercase
  const ret = {}
  for (const [method, list] of Object.entries(json)) {
    ret[method.toUpperCase()] = list
  }
  return ret
}

function getCredentials (method, account = 0) {
  if (!accounts) {
    accounts = loadAccounts()
  }
  const list = accounts[method]
  if (!list || list.length === 0) {
    throw new Error(`Missing account information for method: ${method}`)
  }
  return list[account % list.length]
}

module.exports = {
  getCredentials
}
