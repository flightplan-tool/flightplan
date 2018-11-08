const fp = require('../src/index')

let results

describe('CX: HKG-PVG', () => {
  beforeAll(() => {
    results = fp.Results.parse({
      engine: 'CX',
      query: {
        partners: false,
        cabin: 'economy',
        quantity: 1,
        fromCity: 'HKG',
        toCity: 'PVG',
        departDate: '2019-09-18',
        returnDate: null
      },
      json: [ { name: 'results', path: 'test/__mock__/CX-ORD-PEK-2019-09-18-OWY1X.json' } ]
    })
  })

  test('Result Counts', () => {
    expect(results.awards.length).toBe(13)
    expect(results.flights.length).toBe(6)
  })

  test('BA294 - BA039', () => {
    const flight = results.flights.find(x => x.key() === '2019-09-18:ORD:BA294:1:LHR:BA039')
    expect(flight).toBeDefined()
    expect(flight.awards.length).toBe(1)
    expect(flight.segments.length).toBe(2)

    const award = flight.awards[0]
    expect(award.partner).toBeTruthy()
    expect(award.fare.cabin).toBe('economy')
    expect(award.quantity).toBe(4)
    expect(award.exact).toBeTruthy()
    expect(award.waitlisted).toBeFalsy()

    const [ a, b ] = flight.segments
    expect(a.departure).toBe('17:05')
    expect(a.arrival).toBe('06:50')
    expect(a.lagDays).toBe(1)
    expect(b.departure).toBe('16:30')
    expect(b.arrival).toBe('09:30')
    expect(b.lagDays).toBe(1)
  })
})
