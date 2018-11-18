const moment = require('moment-timezone')

const accounts = require('../shared/accounts')
const fp = require('../src/index')

let results

beforeAll(async (done) => {
  const engine = fp.new('SQ')

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
    fromCity: 'FOC',
    toCity: 'SIN',
    departDate: date,
    returnDate: null,
    cabin: 'first'
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

test('MI995', () => {
  const flight = results.flights.find(x => x.key().includes('FOC:MI995'))
  expect(flight).toBeDefined()
  expect(flight.awards.length).toBeGreaterThan(0)
  expect(flight.segments.length).toBe(1)

  const award = flight.awards.find(x => x.fare.saver)
  expect(award).toBeDefined()
  expect(award.partner).toBeFalsy()
  expect(award.quantity).toBe(1)
  expect(award.fare.cabin).toBe('business')
  expect(award.exact).toBeFalsy()
  expect(award.mileageCost).toBe(27500)

  const segment = flight.segments[0]
  expect(segment.departure).toBe('16:15')
  expect(segment.arrival).toBe('20:45')
  expect(segment.fromCity).toBe('FOC')
  expect(segment.toCity).toBe('SIN')
  expect(segment.aircraft).toBe('B738')
  expect(segment.date).toBe(results.query.departDate)
  expect(segment.lagDays).toBe(0)
})
