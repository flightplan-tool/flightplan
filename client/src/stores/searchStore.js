import { observable, computed, action, autorun } from 'mobx'
import moment from 'moment'
import URLSearchParams from 'url-search-params'

import {
  AIRLINE_NAMES,
  FARE_CODE_NAMES,
  CABIN_ORDER,
} from '../lib/constants'
import { strcmp } from '../lib/utilities'

function flightKey(flight) {
  return JSON.stringify(flight, ['airline', 'flight', 'aircraft'])
}

export default class SearchStore {
  // Query parameters
  @observable fromCity = 'SIN'
  @observable toCity = 'HKG'
  @observable passengers = 1
  @observable direction = 'roundtrip'
  @observable cabinClasses = ['F']
  @observable showWaitlisted = true
  @observable showNonSaver = true
  @observable startDate = moment().add(1, 'd')
  @observable endDate = moment().add(1, 'y')
  @observable selectedAirlines = observable.map()
  @observable selectedFlights = observable.map()

  // Search state
  @observable loading = false
  @observable _results = []

  constructor () {
    autorun(() => {
      if (this.validQuery()) {
        this.search(this.buildQuery())
      }
    })
  }

  // Results, filtered by cabin classes / waitlist / saver
  @computed get results () {
    const {
      cabinClasses,
      showWaitlisted,
      showNonSaver
    } = this

    // Filter results
    const ret = this._results.map(result => {
      let { fareCodes } = result
      fareCodes = fareCodes.split(' ')
      fareCodes = fareCodes.filter(code => {
        return !!cabinClasses.find(x => code.startsWith(x))
      })
      if (!showWaitlisted) {
        fareCodes = fareCodes.filter(x => !x.includes('@'))
      }
      if (!showNonSaver) {
        fareCodes = fareCodes.filter(x => x[1] === 'S')
      }
      return {...result, fareCodes: fareCodes.join(' ')}
    })
    
    // Filter out results with no fares
    return ret.filter(x => x.fareCodes.length !== 0)
  }

  // Results, filtered by selected airlines / flights
  @computed get awards () {
    return this.results.filter(x => (
      this.getAirline(x.airline) &&
      this.getFlight({
        airline: x.airline,
        flight: x.flight,
        aircraft: x.aircraft
      })
    ))
  }

  @computed get airlines () {
    let ret = new Set([...this.results.map(x => x.airline)])
    ret = [...ret.values()].map(x => (
      {code: x, name: AIRLINE_NAMES[x]}
    ))
    ret.sort((x, y) => strcmp(x.name, y.name))
    return ret
  }

  @computed get flights () {
    let ret = []
    for (const result of this.results) {
      let f = {
        airline: result.airline,
        flight: result.flight,
        aircraft: result.aircraft
      }
      if (!ret.find(x => (
        x.flight === f.flight && x.aircraft === f.aircraft
      ))) {
        ret.push(f)
      }
    }
    ret.sort((x, y) => strcmp(x.flight, y.flight, x.aircraft, y.aircraft))
    return ret
  }

  // Build a legend, mapping fare codes to colors
  @computed get legend () {
    const map = new Map()

    for (const award of this.awards) {
      const { airline } = award

      // Initialize the data for an airline
      if (!map.has(airline)) {
        map.set(airline, {
          key: airline,
          name: AIRLINE_NAMES[airline],
          baseCodes: new Set()
        })
      }

      // Add the fare code
      const { baseCodes } = map.get(airline)
      award.fareCodes.split(' ').forEach(code => {
        baseCodes.add(code.slice(0, -1))
      })
    }

    // Sort airlines and fare codes, and assign colors
    let idx = 0
    const legend = [...map.values()].sort((x, y) => strcmp(x.airline, y.airline))
    for (const data of legend) {
      let { baseCodes } = data
      baseCodes = [...baseCodes.values()].sort((a, b) => (
        CABIN_ORDER.indexOf(a) - CABIN_ORDER.indexOf(b)
      ))
      
      // Create fare codes (name with color)
      data.fareCodes = []
      for (const code of baseCodes) {
        data.fareCodes.push({
          key: code + '+',
          name: `${FARE_CODE_NAMES[code]} (${code}+)`,
          index: idx,
          waitlisted: false
        })
        if (this.showWaitlisted) {
          data.fareCodes.push({
            key: code + '@',
            name: `Waitlisted (${code}@)`,
            index: idx,
            waitlisted: true
          })
        }
        idx++
      }
    }

    return legend
  }

  @action toggleClass(code) {
    const { cabinClasses: arr } = this
    const idx = arr.indexOf(code)
    if (idx >= 0) {
      arr.splice(idx, 1)
    } else {
      arr.push(code)
    }
  }

  @action toggleAirline(airline) {
    const { selectedAirlines: sel } = this
    const key = airline.code
    const val = sel.has(key) ? !sel.get(key) : false
    sel.set(key, val)

    // Propagate to flights
    for (const flight of this.flights) {
      this.selectedFlights.set(flightKey(flight), val)
    }
  }

  @action toggleFlight(flight) {
    const { selectedFlights: sel } = this
    const key = flightKey(flight)
    const val = sel.has(key) ? !sel.get(key) : false
    sel.set(key, val)

    // Propagate to airlines
    if (val) {
      this.selectedAirlines.set(flight.airline, true)
    }
  }

  @action update (params) {
    for (const [key, value] of Object.entries(params)) {
      this[key] = value
    }
  }

  @action setResults (results) {
    this.loading = false
    this._results.replace(results)
  }

  getClass (code) {
    return this.cabinClasses.includes(code)
  }

  getAirline (airline) {
    const { selectedAirlines: sel } = this
    const key = airline.code
    return sel.has(key) ? sel.get(key) : true
  }

  getFlight (flight) {
    const { selectedFlights: sel } = this
    const key = flightKey(flight)
    return sel.has(key) ? sel.get(key) : true
  }

  validQuery () {
    return (
      this.validCity(this.fromCity) &&
      this.validCity(this.toCity) &&
      this.validDate(this.startDate) &&
      this.validDate(this.endDate) &&
      this.validPassengers(this.passengers)
    )
  }

  validCity (val) {
    return !!/^[A-Za-z]{3}$/.exec(val)
  }

  validDate (val) {
    return val.isValid()
  }

  validPassengers (val) {
    return Number.isInteger(val) && val >= 1 && val <= 10
  }

  buildQuery () {
    // Build query object
    const { passengers, direction } = this
    const query = {
      fromCity: this.fromCity.toUpperCase(),
      toCity: this.toCity.toUpperCase(),
      passengers,
      direction,
      startDate: this.startDate.format('YYYY-MM-DD'),
      endDate: this.endDate.format('YYYY-MM-DD')
    }

    // Build query string
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      params.append(key, value)
    }
    return 'http://localhost:8000/search?' + params.toString()
  }

  search = (url) => {
    // Send request to server
    this.loading = true
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error('Search query failed:', url)
        }
        return response.json()
      })
      .then(json => this.setResults(json))
      .catch(err => console.error(err))
  }
}