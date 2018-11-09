const fp = require('../src/index')

let results

describe('SQ: ORD-PEK', () => {
  beforeAll(() => {
    results = fp.Results.parse({
      engine: 'SQ',
      query: {
        partners: true,
        cabin: 'economy',
        quantity: 1,
        fromCity: 'ORD',
        toCity: 'PEK',
        departDate: '2019-09-18',
        returnDate: '2019-09-25'
      },
      html: [ { name: 'partners1', path: 'test/__mock__/SQ-ORD-PEK-2019-09-18-RTY1P.html' } ]
    })
  })

  test('Result Counts', () => {
    expect(results.awards.length).toBe(5)
    expect(results.flights.length).toBe(5)
  })

  test('UA2166 - UA888', () => {
    const flight = results.flights.find(x => x.key() === '2019-09-18:ORD:UA2166:0:SFO:UA888')
    expect(flight).toBeDefined()
    expect(flight.awards.length).toBe(1)
    expect(flight.segments.length).toBe(2)

    const award = flight.awards[0]
    expect(award.partner).toBeTruthy()
    expect(award.quantity).toBe(1)
    expect(award.fare.cabin).toBe('economy')
    expect(award.exact).toBeFalsy()

    const [ a, b ] = flight.segments
    expect(a.departure).toBe('07:00')
    expect(a.arrival).toBe('09:50')
    expect(a.fromCity).toBe('ORD')
    expect(a.toCity).toBe('SFO')
    expect(a.aircraft).toBe('B738')
    expect(a.date).toBe('2019-09-18')
    expect(a.lagDays).toBe(0)
    expect(b.departure).toBe('10:45')
    expect(b.arrival).toBe('14:20')
    expect(b.fromCity).toBe('SFO')
    expect(b.toCity).toBe('PEK')
    expect(b.aircraft).toBe('B777')
    expect(b.date).toBe('2019-09-18')
    expect(b.lagDays).toBe(1)
  })
})

describe('SQ: SFO-SIN', () => {
  beforeAll(() => {
    results = fp.Results.parse({
      engine: 'SQ',
      query: {
        partners: true,
        cabin: 'business',
        quantity: 1,
        fromCity: 'SFO',
        toCity: 'SIN',
        departDate: '2019-09-18',
        returnDate: '2019-09-25'
      },
      html: [
        { name: 'results', path: 'test/__mock__/SQ-SFO-SIN-2019-09-18-RTJ1P.html' },
        { name: 'partners1', path: 'test/__mock__/SQ-SFO-SIN-2019-09-18-RTJ1P-1.html' }
      ]
    })
  })

  test('Result Counts', () => {
    expect(results.awards.length).toBe(34)
    expect(results.flights.length).toBe(19)
  })

  test('SQ1', () => {
    const flight = results.flights.find(x => x.key() === '2019-09-18:SFO:SQ1:1:HKG:SQ1')
    expect(flight).toBeDefined()
    expect(flight.awards.length).toBe(2)
    expect(flight.segments.length).toBe(2)

    const saver = flight.awards.find(x => x.fare.saver)
    expect(saver).toBeDefined()
    expect(saver.partner).toBeFalsy()
    expect(saver.quantity).toBe(1)
    expect(saver.fare.cabin).toBe('business')
    expect(saver.exact).toBeFalsy()
    expect(saver.mileageCost).toBe(176000)

    const advantage = flight.awards.find(x => !x.fare.saver)
    expect(advantage).toBeDefined()
    expect(advantage.partner).toBeFalsy()
    expect(advantage.quantity).toBe(1)
    expect(advantage.fare.cabin).toBe('business')
    expect(advantage.exact).toBeFalsy()
    expect(advantage.mileageCost).toBe(240000)

    const [ a, b ] = flight.segments
    expect(a.departure).toBe('01:15')
    expect(a.arrival).toBe('06:35')
    expect(a.fromCity).toBe('SFO')
    expect(a.toCity).toBe('HKG')
    expect(a.aircraft).toBe('B77W')
    expect(a.date).toBe('2019-09-18')
    expect(a.lagDays).toBe(1)
    expect(b.departure).toBe('08:00')
    expect(b.arrival).toBe('11:50')
    expect(b.fromCity).toBe('HKG')
    expect(b.toCity).toBe('SIN')
    expect(b.aircraft).toBe('B77W')
    expect(b.date).toBe('2019-09-19')
    expect(b.lagDays).toBe(0)
  })

  test('SQ32', () => {
    const flight = results.flights.find(x => x.key() === '2019-09-25:SIN:SQ32')
    expect(flight).toBeDefined()
    expect(flight.awards.length).toBe(2)
    expect(flight.segments.length).toBe(1)

    const saver = flight.awards.find(x => x.fare.saver)
    expect(saver).toBeDefined()
    expect(saver.partner).toBeFalsy()
    expect(saver.quantity).toBe(1)
    expect(saver.fare.cabin).toBe('business')
    expect(saver.exact).toBeFalsy()
    expect(saver.waitlisted).toBeTruthy()
    expect(saver.mileageCost).toBe(176000)

    const advantage = flight.awards.find(x => !x.fare.saver)
    expect(advantage).toBeDefined()
    expect(advantage.partner).toBeFalsy()
    expect(advantage.quantity).toBe(1)
    expect(advantage.fare.cabin).toBe('business')
    expect(advantage.exact).toBeFalsy()
    expect(advantage.waitlisted).toBeFalsy()
    expect(advantage.mileageCost).toBe(240000)

    const segment = flight.segments[0]
    expect(segment.departure).toBe('09:25')
    expect(segment.arrival).toBe('09:40')
    expect(segment.fromCity).toBe('SIN')
    expect(segment.toCity).toBe('SFO')
    expect(segment.aircraft).toBe('A359')
    expect(segment.date).toBe('2019-09-25')
    expect(segment.lagDays).toBe(0)
  })

  test('BR27 - BR225', () => {
    const flight = results.flights.find(x => x.key() === '2019-09-18:SFO:BR27:1:TPE:BR225')
    expect(flight).toBeDefined()
    expect(flight.awards.length).toBe(1)
    expect(flight.segments.length).toBe(2)

    const award = flight.awards[0]
    expect(award.fare.saver).toBeTruthy()
    expect(award.partner).toBeTruthy()
    expect(award.quantity).toBe(1)
    expect(award.fare.cabin).toBe('business')
    expect(award.exact).toBeFalsy()
    expect(award.waitlisted).toBeFalsy()
    expect(award.mileageCost).toBe(195000)

    const [ a, b ] = flight.segments
    expect(a.departure).toBe('01:20')
    expect(a.arrival).toBe('05:50')
    expect(a.fromCity).toBe('SFO')
    expect(a.toCity).toBe('TPE')
    expect(a.aircraft).toBe('B77W')
    expect(a.date).toBe('2019-09-18')
    expect(a.lagDays).toBe(1)
    expect(b.departure).toBe('07:40')
    expect(b.arrival).toBe('12:00')
    expect(b.fromCity).toBe('TPE')
    expect(b.toCity).toBe('SIN')
    expect(b.aircraft).toBe('B77W')
    expect(b.date).toBe('2019-09-19')
    expect(b.lagDays).toBe(0)
  })
})
