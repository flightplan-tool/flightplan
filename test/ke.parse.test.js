const fp = require('../src/index')

let results

describe('KE: ORD-PEK', () => {
  beforeAll(() => {
    results = fp.Results.parse({
      engine: 'KE',
      query: {
        partners: true,
        cabin: 'business',
        quantity: 1,
        fromCity: 'ORD',
        toCity: 'PEK',
        departDate: '2019-09-18',
        returnDate: '2019-09-25'
      },
      json: [ { name: 'results', path: 'test/__mock__/KE-ORD-PEK-2019-09-18-RTJ1P.json' } ]
    })
  })

  test('Result Counts', () => {
    expect(results.awards.length).toBe(30)
    expect(results.flights.length).toBe(30)
  })

  test('KE038 - KE859', () => {
    const flight = results.flights.find(x => x.key() === '2019-09-18:ORD:KE038:1:ICN:KE859')
    expect(flight).toBeDefined()
    expect(flight.awards.length).toBe(1)
    expect(flight.segments.length).toBe(2)

    const award = flight.awards[0]
    expect(award.partner).toBeFalsy()
    expect(award.quantity).toBe(3)
    expect(award.fare.cabin).toBe('business')
    expect(award.exact).toBeTruthy()

    const [ a, b ] = flight.segments
    expect(a.departure).toBe('12:35')
    expect(a.arrival).toBe('16:25')
    expect(a.fromCity).toBe('ORD')
    expect(a.toCity).toBe('ICN')
    expect(a.aircraft).toBe('77W')
    expect(a.date).toBe('2019-09-18')
    expect(a.lagDays).toBe(1)
    expect(b.departure).toBe('23:55')
    expect(b.arrival).toBe('01:05')
    expect(b.fromCity).toBe('ICN')
    expect(b.toCity).toBe('PEK')
    expect(b.aircraft).toBe('73J')
    expect(b.date).toBe('2019-09-19')
    expect(b.lagDays).toBe(1)
  })

  test('MU5158 - KE816 - KE037', () => {
    const flight = results.flights.find(x => x.key() === '2019-09-25:PEK:MU5158:1:SHA:KE816:2:ICN:KE037')
    expect(flight).toBeDefined()
    expect(flight.awards.length).toBe(1)
    expect(flight.segments.length).toBe(3)

    const award = flight.awards[0]
    expect(award.partner).toBeTruthy()
    expect(award.quantity).toBe(4)
    expect(award.fare.cabin).toBe('business')
    expect(award.exact).toBeTruthy()

    const [ a, b, c ] = flight.segments
    expect(a.departure).toBe('21:30')
    expect(a.arrival).toBe('23:45')
    expect(a.fromCity).toBe('PEK')
    expect(a.toCity).toBe('SHA')
    expect(a.aircraft).toBe('333')
    expect(a.date).toBe('2019-09-25')
    expect(a.lagDays).toBe(0)
    expect(b.departure).toBe('18:35')
    expect(b.arrival).toBe('21:35')
    expect(b.fromCity).toBe('SHA')
    expect(b.toCity).toBe('GMP')
    expect(b.aircraft).toBe('772')
    expect(b.date).toBe('2019-09-26')
    expect(b.lagDays).toBe(0)
    expect(c.departure).toBe('10:40')
    expect(c.arrival).toBe('09:25')
    expect(c.fromCity).toBe('ICN')
    expect(c.toCity).toBe('ORD')
    expect(c.aircraft).toBe('77W')
    expect(c.date).toBe('2019-09-27')
    expect(c.lagDays).toBe(0)
  })
})
