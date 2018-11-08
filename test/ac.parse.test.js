const fp = require('../src/index')

let results

describe('AC: ORD-PEK', () => {
  beforeAll(() => {
    results = fp.Results.parse({
      engine: 'AC',
      query: {
        partners: false,
        cabin: 'economy',
        quantity: 1,
        fromCity: 'ORD',
        toCity: 'PEK',
        departDate: '2019-09-18',
        returnDate: '2019-09-25'
      },
      json: [ { name: 'results', path: 'test/__mock__/AC-ORD-PEK-2019-09-18-OWY1X.json' } ]
    })
  })

  test('Result Counts', () => {
    expect(results.awards.length).toBe(60)
    expect(results.flights.length).toBe(37)
  })

  test('UA851', () => {
    const flight = results.flights.find(x => x.key() === '2019-09-18:ORD:UA851')
    expect(flight).toBeDefined()
    expect(flight.awards.length).toBe(2)

    const businessAward = flight.awards.find(x => x.fare.cabin === 'business')
    expect(businessAward).toBeDefined()
    expect(businessAward.mileageCost).toBe(150000)

    const economyAward = flight.awards.find(x => x.fare.cabin === 'economy')
    expect(economyAward).toBeDefined()
    expect(economyAward.mileageCost).toBe(75000)

    expect(flight.awards.every(x => x.partner)).toBeTruthy()
  })

  test('AC500 - AC31', () => {
    const flight = results.flights.find(x => x.key() === '2019-09-18:ORD:AC500:0:YYZ:AC31')
    expect(flight).toBeDefined()
    expect(flight.awards.length).toBe(4)

    expect(flight.awards.every(x => x.partner)).toBeFalsy()
  })

  test('AC7598 - AC411 - AC31', () => {
    const flight = results.flights.find(x => x.key() === '2019-09-18:ORD:AC7598:0:YUL:AC411:0:YYZ:AC31')
    expect(flight).toBeDefined()
    expect(flight.awards.length).toBe(3)

    expect(flight.awards.every(x => x.partner)).toBeFalsy()
  })

  test('NH111 - NH961', () => {
    const flight = results.flights.find(x => x.key() === '2019-09-18:ORD:NH111:2:HND:NH961')
    expect(flight).toBeDefined()
    expect(flight.awards.length).toBe(1)

    const award = flight.awards[0]
    expect(award.partner).toBeTruthy()
    expect(award.cabins).toEqual([ 'first', 'business' ])
    expect(award.fare.code).toBe('OS')
    expect(award.quantity).toBe(1)
    expect(award.exact).toBeFalsy()
    expect(award.waitlisted).toBeFalsy()
    expect(award.mileageCost).toBe(210000)
  })
})

describe('AC: PEK-YYZ', () => {
  beforeAll(() => {
    results = fp.Results.parse({
      engine: 'AC',
      query: {
        partners: false,
        cabin: 'economy',
        quantity: 1,
        fromCity: 'PEK',
        toCity: 'YYZ',
        departDate: '2019-09-18',
        returnDate: null
      },
      json: [ { name: 'results', path: 'test/__mock__/AC-PEK-YYZ-2019-09-18-OWY1X.json' } ]
    })
  })

  test('Result Counts', () => {
    expect(results.awards.length).toBe(56)
    expect(results.flights.length).toBe(30)
  })

  test('CA983 - AC788', () => {
    const flight = results.flights.find(x => x.key() === '2019-09-18:PEK:CA983:0:LAX:AC788')
    expect(flight).toBeDefined()
    expect(flight.awards.length).toBe(1)

    const award = flight.awards[0]
    expect(award.partner).toBeTruthy()
    expect(award.cabins).toEqual([ 'first', 'business' ])
    expect(award.fare.code).toBe('OS')
    expect(award.quantity).toBe(1)
    expect(award.exact).toBeFalsy()
    expect(award.waitlisted).toBeFalsy()
    expect(award.mileageCost).toBe(105000)

    expect(flight.segments[0].toCity).toBe('LAX')
    expect(flight.segments[1].fromCity).toBe('LAX')
  })

  test('CA985 - AC750', () => {
    const flight = results.flights.find(x => x.key() === '2019-09-18:PEK:CA985:0:SFO:AC750')
    expect(flight).toBeDefined()
    expect(flight.awards.length).toBe(1)

    const award = flight.awards[0]
    expect(award.partner).toBeTruthy()
    expect(award.cabins).toEqual([ 'first', 'economy' ])
    expect(award.fare.code).toBe('OS')
    expect(award.quantity).toBe(1)
    expect(award.exact).toBeFalsy()
    expect(award.waitlisted).toBeFalsy()
    expect(award.mileageCost).toBe(105000)

    expect(flight.segments[0].toCity).toBe('SFO')
    expect(flight.segments[1].fromCity).toBe('SFO')
  })

  test('CA987 - AC786', () => {
    const flight = results.flights.find(x => x.key() === '2019-09-18:PEK:CA987:0:LAX:AC786')
    expect(flight).toBeDefined()
    expect(flight.awards.length).toBe(1)

    const award = flight.awards[0]
    expect(award.partner).toBeTruthy()
    expect(award.cabins).toEqual([ 'first', 'economy' ])
    expect(award.fare.code).toBe('OS')
    expect(award.quantity).toBe(1)
    expect(award.exact).toBeFalsy()
    expect(award.waitlisted).toBeFalsy()
    expect(award.mileageCost).toBe(105000)

    expect(flight.segments[0].toCity).toBe('LAX')
    expect(flight.segments[1].fromCity).toBe('LAX')
  })
})
