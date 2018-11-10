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
    expect(results.awards.length).toBe(6)
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

describe('CX: SFO-HKG', () => {
  beforeAll(() => {
    results = fp.Results.parse({
      engine: 'CX',
      query: {
        partners: false,
        cabin: 'business',
        quantity: 1,
        fromCity: 'SFO',
        toCity: 'HKG',
        departDate: '2018-11-14',
        returnDate: null
      },
      json: [ { name: 'results', path: 'test/__mock__/CX-SFO-HKG-2018-11-14-OWJ1X.json' } ]
    })
  })

  test('Result Counts', () => {
    expect(results.awards.length).toBe(45)
    expect(results.flights.length).toBe(37)
  })

  test('CX873', () => {
    const flight = results.flights.find(x => x.key() === '2018-11-14:SFO:CX873')
    expect(flight).toBeDefined()
    expect(flight.awards.length).toBe(5)
    expect(flight.segments.length).toBe(1)

    const cs = flight.awards.find(x => x.fare.code === 'CS')
    expect(cs.cabins).toContain('business')
    expect(cs.quantity).toBe(1)
    expect(cs.exact).toBeFalsy()
    expect(cs.waitlisted).toBeTruthy()
    expect(cs.mileageCost).toBe(70000)

    const c1 = flight.awards.find(x => x.fare.code === 'C1')
    expect(c1.cabins).toContain('business')
    expect(c1.quantity).toBe(3)
    expect(c1.exact).toBeTruthy()
    expect(c1.waitlisted).toBeFalsy()
    expect(c1.mileageCost).toBe(105000)

    const fs = flight.awards.find(x => x.fare.code === 'FS')
    expect(fs.cabins).toContain('first')
    expect(fs.quantity).toBe(1)
    expect(fs.exact).toBeFalsy()
    expect(fs.waitlisted).toBeTruthy()
    expect(fs.mileageCost).toBe(110000)

    const f1 = flight.awards.find(x => x.fare.code === 'F1')
    expect(f1.cabins).toContain('first')
    expect(f1.quantity).toBe(1)
    expect(f1.exact).toBeFalsy()
    expect(f1.waitlisted).toBeTruthy()
    expect(f1.mileageCost).toBe(165000)

    const segment = flight.segments[0]
    expect(segment.departure).toBe('22:55')
    expect(segment.arrival).toBe('06:10')
    expect(segment.fromCity).toBe('SFO')
    expect(segment.toCity).toBe('HKG')
    expect(segment.aircraft).toBe('B77W')
    expect(segment.date).toBe('2018-11-14')
    expect(segment.lagDays).toBe(2)
  })

  test('AS1034 - CX865', () => {
    const flight = results.flights.find(x => x.key() === '2018-11-14:SFO:AS1034:1:JFK:CX865')
    expect(flight).toBeDefined()
    expect(flight.awards.length).toBe(1)
    expect(flight.segments.length).toBe(2)

    const fs = flight.awards.find(x => x.fare.code === 'FS')
    expect(fs.cabins).toContain('first')
    expect(fs.quantity).toBe(1)
    expect(fs.exact).toBeFalsy()
    expect(fs.waitlisted).toBeTruthy()
    expect(fs.mileageCost).toBe(135000)

    const [ a, b ] = flight.segments
    expect(a.departure).toBe('23:10')
    expect(a.arrival).toBe('07:43')
    expect(a.fromCity).toBe('SFO')
    expect(a.toCity).toBe('JFK')
    expect(a.aircraft).toBe('A32S')
    expect(a.date).toBe('2018-11-14')
    expect(a.lagDays).toBe(1)
    expect(b.departure).toBe('20:35')
    expect(b.arrival).toBe('07:10')
    expect(b.fromCity).toBe('JFK')
    expect(b.toCity).toBe('HKG')
    expect(b.aircraft).toBe('B77W')
    expect(b.date).toBe('2018-11-15')
    expect(b.lagDays).toBe(2)
  })
})
