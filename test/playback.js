const fs = require('fs')
const timetable = require('timetable-fns')

const fp = require('../src/index')
const accounts = require('../shared/accounts')

function findTestCases (id) {
  const cases = fs.readdirSync('./test/__mock__')
    .filter(x => x.startsWith(`${id}-`) && x.endsWith('.results.json'))
    .map(x => JSON.parse(fs.readFileSync('./test/__mock__/' + x, 'utf8')))
  cases.forEach(x => {
    const { fromCity, toCity, departDate, returnDate, cabin, quantity, partners } = x.query
    let delta = returnDate ? timetable.diff(departDate, returnDate) : 0
    delta = (delta > 0) ? `+${delta}` : delta
    const dates = returnDate ? `${departDate} ${delta}` : `${departDate} OW`
    x.name = `${fromCity}-${toCity} (${dates}, ${cabin}, ${quantity}x${partners ? ', partners' : ''})`
  })
  return cases
}

function flightKey (flight) {
  return flight.segments.reduce((arr, x) => {
    arr.push(x.date, x.fromCity, x.flight)
    return arr
  }, []).join(':')
}

function flightMap (results) {
  return results.flights.reduce((map, x) => {
    map.set(flightKey(x), x)
    return map
  }, new Map())
}

function awardMap (results) {
  const map = new Map()
  for (const flight of results.flights) {
    const key = flightKey(flight)
    for (const award of flight.awards) {
      map.set(`${key}:${award.fare}`, award)
    }
    delete flight.awards
  }
  return map
}

function compareMaps (oldMap, newMap, exact) {
  if (!exact && oldMap.size > 0) {
    let missing = 0
    for (const [ key, oldVal ] of oldMap) {
      const newVal = newMap.get(key)
      if (newVal) {
        expect(newVal).toEqual(oldVal)
        newMap.delete(key)
      } else {
        missing++
      }
    }
    const added = newMap.size

    const limit = 0.5 * oldMap.size
    if (missing <= limit && added <= limit) {
      if (missing !== 0 || added !== 0) {
        const percentMissing = (100 * missing / oldMap.size).toFixed(1)
        const msgMissing = `missing=${missing} (${percentMissing}%)`
        const percentAdded = (100 * added / oldMap.size).toFixed(1)
        const msgAdded = `added=${added} (${percentAdded}%)`
        console.log(`Detected difference within tolerance: ${msgMissing}, ${msgAdded}`)
      }
      return
    }
  }

  // Create arrays from maps, and compare them
  const oldArr = [...oldMap.entries()].sort((x, y) => x[0] - y[0]).map(x => x[1])
  const newArr = [...newMap.entries()].sort((x, y) => x[0] - y[0]).map(x => x[1])
  expect(newArr).toEqual(oldArr)
}

function compare (orig, results, exact = true) {
  // Force parsing of awards, and check for errors
  const { flights } = results
  expect(results.ok).toBeTruthy()
  expect(results.error).toBeNull()

  // Ensure validity of flights and segments
  for (const flight of flights) {
    const { segments } = flight
    const n = segments.length
    for (let i = 0; i < n; i++) {
      if (i < n - 1) {
        expect(segments[i].nextConnection).toBeGreaterThanOrEqual(0)
      }
      expect(segments[i].duration).toBeGreaterThanOrEqual(0)
      expect(() => segments[i].overnight).not.toThrow()
    }
    for (const award of flight.awards) {
      expect(award.cabins.length).toBe(n)
    }
  }

  // Convert results to JSON for comparison
  results = results.trimContents().toJSON(true)

  // Remove awards from flights, and into separate maps
  const origAwards = awardMap(orig)
  const newAwards = awardMap(results)

  // Create a mapping of flights, so we can compare
  const origFlights = flightMap(orig)
  const newFlights = flightMap(results)

  // Calculate the differences
  compareMaps(origFlights, newFlights, exact)
  compareMaps(origAwards, newAwards, exact)
}

function parse (id) {
  const cases = findTestCases(id)

  describe(`${id}: Parse (${cases.length} test case${cases.length > 1 ? 's' : ''})`, () => {
    for (const testCase of cases) {
      test(testCase.name, () => {
        const results = fp.Results.parse({
          engine: id,
          query: testCase.query,
          html: testCase.html,
          json: testCase.json
        })

        compare(testCase, results, true)
      })
    }
  })
}

function search (id) {
  const cases = findTestCases(id)
  const resultsMap = new Map()

  describe(`${id}: Search (${cases.length} test cases)`, () => {
    beforeAll(async (done) => {
      const engine = fp.new(id)

      // Initialize the engine
      const credentials = engine.loginRequired
        ? accounts.getCredentials(engine.id) : null
      await engine.initialize({ credentials, headless: true, verbose: false, throttle: false })

      // // Get a start date nearly a year out, on a Wednesday
      // let date = moment().add(46, 'weeks')
      // while (date.weekday() !== 3) {
      //   date.subtract(1, 'day')
      // }

      // Execute each query from the test case
      for (const testCase of cases) {
        const results = await engine.search(testCase.query)
        resultsMap.set(testCase.name, results)
      }

      // Cleanup
      await engine.close()
      done()
    })

    for (const testCase of cases) {
      test(testCase.name, () => {
        const results = resultsMap.get(testCase.name)
        compare(testCase, results, false)
      })
    }
  })
}

module.exports = {
  parse,
  search
}
