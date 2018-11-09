const accounts = require('../shared/accounts')
const fp = require('../src/index')
const { DateTime } = require('luxon')

let results

beforeAll(async (done) => {
  const engine = fp.new('KE')

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
    fromCity: 'ICN',
    toCity: 'LAX',
    departDate: date,
    returnDate: date.plus({ days: 7 }),
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

test('KE017', () => {
  const flight = results.flights.find(x => x.key().includes('ICN:KE017'))
  expect(flight).toBeDefined()
  expect(flight.awards.length).toBe(1)
  expect(flight.segments.length).toBe(1)

  const award = flight.awards[0]
  expect(award.quantity).toBeGreaterThan(0)
  expect(award.fare.cabin).toBe('first')

  const segment = flight.segments[0]
  expect(segment.departure).toBe('14:30')
  expect(segment.arrival).toBe('09:40')
  expect(segment.fromCity).toBe('ICN')
  expect(segment.toCity).toBe('LAX')
  expect(segment.aircraft).toBe('388')
  expect(segment.date).toBe(results.query.departDate)
  expect(segment.lagDays).toBe(0)
})

test('KE012', () => {
  const flight = results.flights.find(x => x.key().includes('LAX:KE012'))
  expect(flight).toBeDefined()
  expect(flight.awards.length).toBe(1)
  expect(flight.segments.length).toBe(1)

  const award = flight.awards[0]
  expect(award.quantity).toBeGreaterThan(0)
  expect(award.fare.cabin).toBe('first')

  const segment = flight.segments[0]
  expect(segment.departure).toBe('23:30')
  expect(segment.arrival).toBe('04:50')
  expect(segment.fromCity).toBe('LAX')
  expect(segment.toCity).toBe('ICN')
  expect(segment.aircraft).toBe('388')
  expect(segment.date).toBe(results.query.returnDate)
  expect(segment.lagDays).toBe(2)
})
