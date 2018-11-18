const moment = require('moment-timezone')

const accounts = require('../shared/accounts')
const fp = require('../src/index')

let results

beforeAll(async (done) => {
  const engine = fp.new('AC')

  // Initialize the engine
  const credentials = engine.loginRequired
    ? accounts.getCredentials(engine.id) : null
  await engine.initialize({ credentials, headless: true, verbose: false })

  // Get a start date nearly a year out, on a Wednesday
  let date = moment().add(46, 'weeks')
  while (date.weekday() !== 3) {
    date.subtract(1, 'day')
  }

  // Run the search
  results = await engine.search({
    fromCity: 'ORD',
    toCity: 'PEK',
    departDate: date,
    returnDate: date.clone().add(1, 'week'),
    cabin: 'economy'
  })

  // Clean up the engine
  await engine.close()

  done()
})

test('Validate results', () => {
  expect(results.error).toBeFalsy()
  expect(results.awards.length).toBeGreaterThan(0)
  expect(results.flights.length).toBeGreaterThan(0)
})

test('AC500 - AC31', () => {
  const flight = results.flights.find(x => x.key().includes('ORD:AC500:0:YYZ:AC31'))
  expect(flight).toBeDefined()
  expect(flight.awards.length).toBeGreaterThan(0)
})

// test('UA1650 - AC7404 - AC31', () => {
//   const flight = results.flights.find(x => x.key().includes('ORD:UA1650:0:CLE:AC7404:0:YYZ:AC31'))
//   expect(flight).toBeDefined()
//   expect(flight.awards.length).toBeGreaterThan(0)
// })
