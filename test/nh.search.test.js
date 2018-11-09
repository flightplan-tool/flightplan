const accounts = require('../shared/accounts')
const fp = require('../src/index')
const { DateTime } = require('luxon')

let results

beforeAll(async (done) => {
  const engine = fp.new('NH')

  // Initialize the engine
  const credentials = engine.loginRequired
    ? accounts.getCredentials(engine.id) : null
  await engine.initialize({ credentials, headless: true, verbose: false })

  // Get a start date nearly a year out, on a Wednesday
  let date = DateTime.local().plus({ weeks: 46 })
  while (date.weekday !== 3) {
    date = date.minus({ days: 1 })
  }

  // Run the search
  results = await engine.search({
    fromCity: 'ORD',
    toCity: 'PEK',
    departDate: date,
    returnDate: null,
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

test('Waitlisted Business Award', () => {
  // There should be at least one waitlisted business award
  const award = results.awards.find(x => x.fare.cabin === fp.cabins.business && x.waitlisted)
  expect(award).toBeDefined()
})

test('NH111 - NH955', () => {
  const flight = results.flights.find(x => x.key().includes('ORD:NH111:2:NRT:NH955'))
  expect(flight).toBeDefined()
  expect(flight.awards.length).toBeGreaterThan(0)

  const [ a, b ] = flight.segments
  expect(a.departure).toBe('17:25')
  expect(a.arrival).toBe('20:30')
  expect(a.fromCity).toBe('ORD')
  expect(a.toCity).toBe('HND')
  expect(a.aircraft).toBe('77W')
  expect(a.date).toBe(results.query.departDate)
  expect(a.lagDays).toBe(1)
  expect(b.departure).toBe('18:20')
  expect(b.arrival).toBe('21:20')
  expect(b.fromCity).toBe('NRT')
  expect(b.toCity).toBe('PEK')
  expect(b.aircraft).toBe('763')
  expect(b.date).toBe(results.query.departDateObject().plus({ days: 2 }).toSQLDate())
  expect(b.lagDays).toBe(0)
})
