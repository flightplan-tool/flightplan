const program = require('commander')
const fs = require('fs')
const timetable = require('timetable-fns')

const fp = require('../src')
const accounts = require('../shared/accounts')
const logger = require('../shared/logger')
const utils = require('../src/utils')

program
  .option('-w, --website <airline>', 'IATA 2-letter code of the airline whose website to search')
  .option('-p, --partners', `Include partner awards (default: false)`)
  .option('-f, --from <city>', `IATA 3-letter code of the departure airport`)
  .option('-t, --to <city>', `IATA 3-letter code of the arrival airport`)
  .option('-c, --cabin <class>', `Cabin (${Object.keys(fp.cabins).join(', ')})`, (x) => (x in fp.cabins) ? x : false, undefined)
  .option('-d, --depart <date>', `Departure date (YYYY-MM-DD)`, undefined)
  .option('-r, --return <date>', `Return date (YYYY-MM-DD)`, undefined)
  .option('-q, --quantity <n>', `# of passengers traveling`, (x) => parseInt(x), 1)
  .option('-h, --headless', `Run Chrome in headless mode`)
  .on('--help', () => {
    console.log('')
    console.log('  Supported Websites:')
    console.log('')
    fp.supported().forEach(id => console.log(`    ${id} - ${fp.new(id).config.name}`))
  })
  .parse(process.argv)

function fatal (message) {
  logger.error(message)
  process.exit(1)
}

const main = async (args) => {
  // Normalize arguments
  args.partners = !!args.partners
  args.headless = !!args.headless

  const {
    website,
    partners,
    from: fromCity,
    to: toCity,
    cabin,
    depart: departDate,
    return: returnDate,
    quantity,
    headless
  } = args

  // Validate arguments
  if (!fp.supported(website || '')) {
    fatal(`Unsupported airline website to search: ${website}`)
  }
  if (!utils.validAirportCode(fromCity)) {
    fatal(`Invalid from city: ${fromCity}`)
  }
  if (!utils.validAirportCode(toCity)) {
    fatal(`Invalid to city: ${toCity}`)
  }
  if (!(cabin in fp.cabins)) {
    fatal(`Unrecognized cabin specified: ${cabin}`)
  }
  if (!timetable.valid(departDate)) {
    fatal(`Invalid departure date: ${departDate}`)
  }
  if (returnDate && !timetable.valid(returnDate)) {
    fatal(`Invalid return date: ${returnDate}`)
  }
  if (quantity < 1) {
    fatal(`Invalid quantity: ${quantity}`)
  }

  // Create and initialize engine
  const engine = fp.new(website)
  engine.info(`Initializing engine...`)
  const credentials = engine.loginRequired
    ? accounts.getCredentials(engine.id) : null
  await engine.initialize({ credentials, headless })

  // Create path to store assets and parsed results
  const params = [ returnDate ? 'RT' : 'OW', quantity, fp.cabinCodes[cabin], partners ? 'P' : '' ].join('')
  const hash = (Date.now() & 0xFFFF).toString(16).padStart(4, '0')
  const path = './test/__mock__/' + [ engine.id, fromCity, toCity, departDate, params, hash ].join('-')

  // Create the search query
  const query = new fp.Query({
    partners,
    cabin,
    quantity,
    fromCity,
    toCity,
    departDate,
    returnDate,
    html: { path: path + '.html' },
    json: { path: path + '.json' },
    screenshot: { path: path + '.jpg' }
  })

  // Run the search
  engine.info(`Running search...`)
  const results = await engine.search(query)

  // Save the parsed results as well
  const { awards } = results
  if (results.ok) {
    engine.success(`Found ${awards.length} awards.`)
    const json = JSON.stringify(results.trimContents().toJSON(true), null, 4)
    fs.writeFileSync(path + '.results.json', json)
  } else {
    engine.error(`Failed to parse awards: ${results.error}`)
  }
  await engine.close()

  // Create data path if necessary
  if (!fs.existsSync('test/__mock__')) {
    fatal(`Could not find mock data directory: test/__mock__`)
  }
}

main(program)
