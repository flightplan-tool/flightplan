const fp = require('../src/index')

let results

describe('NH: HKG-HND', () => {
  beforeAll(() => {
    results = fp.Results.parse({
      engine: 'NH',
      query: {
        partners: false,
        cabin: 'economy',
        quantity: 1,
        fromCity: 'HKG',
        toCity: 'HND',
        departDate: '2019-09-18',
        returnDate: '2019-09-25'
      },
      html: [
        { name: 'outbound', path: 'test/__mock__/NH-HKG-HND-2019-09-18-RTY1X.html' },
        { name: 'inbound', path: 'test/__mock__/NH-HKG-HND-2019-09-18-RTY1X-1.html' }
      ],
      json: [ { name: 'airports', path: 'test/__mock__/NH-HKG-HND-2019-09-18-RTY1X.json' } ]
    })
  })

  test('Result Counts', () => {
    expect(results.awards.length).toBe(96)
    expect(results.flights.length).toBe(56)
  })

  test('NH822', () => {
    const flight = results.flights.find(x => x.key() === '2019-09-18:HKG:NH822')
    expect(flight).toBeDefined()
    expect(flight.awards.length).toBe(2)
    expect(flight.segments.length).toBe(1)

    for (const award of flight.awards) {
      expect(award.partner).toBeFalsy()
      expect(award.quantity).toBe(1)
      expect(award.exact).toBeFalsy()
      expect(award.waitlisted).toBeFalsy()
    }

    const segment = flight.segments[0]
    expect(segment.departure).toBe('01:05')
    expect(segment.arrival).toBe('06:10')
    expect(segment.fromCity).toBe('HKG')
    expect(segment.toCity).toBe('HND')
    expect(segment.aircraft).toBe('763')
    expect(segment.date).toBe('2019-09-18')
    expect(segment.lagDays).toBe(0)
  })

  test('NH859', () => {
    const flight = results.flights.find(x => x.key() === '2019-09-25:HND:NH859')
    expect(flight).toBeDefined()
    expect(flight.awards.length).toBe(2)
    expect(flight.segments.length).toBe(1)

    for (const award of flight.awards) {
      expect(award.partner).toBeFalsy()
      expect(award.quantity).toBe(1)
      expect(award.exact).toBeFalsy()
      expect(award.waitlisted).toBeFalsy()
    }

    const segment = flight.segments[0]
    expect(segment.departure).toBe('08:50')
    expect(segment.arrival).toBe('12:25')
    expect(segment.fromCity).toBe('HND')
    expect(segment.toCity).toBe('HKG')
    expect(segment.aircraft).toBe('789')
    expect(segment.date).toBe('2019-09-25')
    expect(segment.lagDays).toBe(0)
  })

  test('TG629 - NH850', () => {
    const flight = results.flights.find(x => x.key() === '2019-09-18:HKG:TG629:0:BKK:NH850')
    expect(flight).toBeDefined()
    expect(flight.awards.length).toBe(2)
    expect(flight.segments.length).toBe(2)

    for (const award of flight.awards) {
      expect(award.partner).toBeTruthy()
      expect(award.quantity).toBe(1)
      expect(award.exact).toBeFalsy()
      expect(award.waitlisted).toBeFalsy()
    }

    const [ a, b ] = flight.segments
    expect(a.departure).toBe('15:30')
    expect(a.arrival).toBe('17:10')
    expect(a.fromCity).toBe('HKG')
    expect(a.toCity).toBe('BKK')
    expect(a.aircraft).toBe('773')
    expect(a.date).toBe('2019-09-18')
    expect(a.lagDays).toBe(0)
    expect(b.departure).toBe('21:45')
    expect(b.arrival).toBe('05:55')
    expect(b.fromCity).toBe('BKK')
    expect(b.toCity).toBe('HND')
    expect(b.aircraft).toBe('789')
    expect(b.date).toBe('2019-09-18')
    expect(b.lagDays).toBe(1)
  })

  test('NH874 - OZ115 - OZ1045', () => {
    const flight = results.flights.find(x => x.key() === '2019-09-18:HKG:NH874:1:KIX:OZ115:1:GMP:OZ1045')
    expect(flight).toBeDefined()
    expect(flight.awards.length).toBe(2)
    expect(flight.segments.length).toBe(3)

    for (const award of flight.awards) {
      expect(award.partner).toBeTruthy()
      expect(award.quantity).toBe(1)
      expect(award.exact).toBeFalsy()
      expect(award.waitlisted).toBeFalsy()
    }

    const [ a, b, c ] = flight.segments
    expect(a.departure).toBe('15:20')
    expect(a.arrival).toBe('20:05')
    expect(a.fromCity).toBe('HKG')
    expect(a.toCity).toBe('KIX')
    expect(a.aircraft).toBe('763')
    expect(a.date).toBe('2019-09-18')
    expect(a.lagDays).toBe(0)
    expect(b.departure).toBe('09:10')
    expect(b.arrival).toBe('11:00')
    expect(b.fromCity).toBe('KIX')
    expect(b.toCity).toBe('ICN')
    expect(b.aircraft).toBe('321')
    expect(b.date).toBe('2019-09-19')
    expect(b.lagDays).toBe(0)
    expect(c.departure).toBe('15:50')
    expect(c.arrival).toBe('17:55')
    expect(c.fromCity).toBe('GMP')
    expect(c.toCity).toBe('HND')
    expect(c.aircraft).toBe('333')
    expect(c.date).toBe('2019-09-19')
    expect(c.lagDays).toBe(0)
  })
})
