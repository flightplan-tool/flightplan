import { observable, computed, action, autorun } from 'mobx'
import moment from 'moment'
import URLSearchParams from 'url-search-params'

import { strcmp } from '../lib/utilities'

function flightKey(flight) {
  return JSON.stringify(flight, ['airline', 'flight', 'aircraft'])
}

export default class SearchStore {
  // Query parameters
  @observable fromCity = 'SIN'
  @observable toCity = 'HKG'
  @observable quantity = 1
  @observable direction = 'roundtrip'
  @observable cabinClasses = ['first']
  @observable showWaitlisted = true
  @observable showNonSaver = true
  @observable startDate = moment().add(1, 'd')
  @observable endDate = moment().add(1, 'y')
  @observable selectedAirlines = observable.map()
  @observable selectedFlights = observable.map()

  // Search state
  @observable loading = false
  @observable _results = []

  constructor (configStore) {
    this.configStore = configStore

    // Execute search query whenever it is updated, and valid
    autorun(() => {
      if (this.validQuery()) {
        this.search(this.buildQuery())
      }
    })
  }

  // Results, filtered by cabin classes / waitlist / saver
  @computed get results () {
    const { showWaitlisted, showNonSaver } = this
    const { configStore } = this
    
    // Check if config is loaded yet
    if (configStore.loading) {
      return []
    }

    // Keep a map of fare info for faster lookup
    const fareInfo = new Map()
    configStore.config.airlines.forEach((airline) => {
      const { id, fares } = airline
      fareInfo.set(id, fares.reduce((map, fare) => {
        map.set(fare.code, fare)
        return map
      }, new Map()))
    })

    // Filter results
    const ret = this._results.map(result => {
      let { engine, fares } = result
      const map = fareInfo.get(engine)

      fares = fares.split(' ')
      fares = fares.filter(code => {
        const fare = map.get(code.slice(0, -1))
        return (
          (showNonSaver || fare.saver) &&
          (showWaitlisted || !code.includes('@'))
        )
      })
      return {...result, fares: fares.join(' ')}
    })
    
    // Filter out results with no fares
    return ret.filter(x => x.fares.length !== 0)
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

  @computed get airlineInfo () {
    const map = new Map()
    const airlines = this.configStore.airlines
    if (airlines) {
      for (const airline of airlines) {
        map.set(airline.id, airline)
      }
    }
    return map
  }

  @computed get airlines () {
    const { airlineInfo } = this
    let ret = new Set([...this.results.map(x => x.airline)])
    ret = [...ret.values()].map(x => (
      {code: x, name: airlineInfo.get(x).name}
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
    const { airlineInfo } = this

    for (const award of this.awards) {
      const { airline } = award
      const { name, fares } = airlineInfo.get(airline)

      // Initialize the data for an airline
      if (!map.has(airline)) {
        map.set(airline, {
          key: airline, name, fares, awards: new Set()
        })
      }

      // Add the award
      const { awards } = map.get(airline)
      award.fares.split(' ').forEach(code => {
        awards.add(code.slice(0, -1))
      })
    }

    // Sort airlines and fares, and assign colors
    let idx = 0
    const legend = [...map.values()].sort((x, y) => strcmp(x.name, y.name))
    for (const data of legend) {
      // Generate sorted list of awards, based on search results
      const { fares, awards } = data
      data.fares = []
      for (const fare of fares.filter(x => awards.has(x.code))) {
        const { code, name } = fare
        data.fares.push({
          key: code + '+',
          name: `${name} (${code}+)`,
          index: idx,
          waitlisted: false
        })
        if (this.showWaitlisted) {
          data.fares.push({
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
      this.validQuantity(this.quantity)
    )
  }

  validCity (val) {
    return !!/^[A-Za-z]{3}$/.exec(val)
  }

  validDate (val) {
    return val.isValid()
  }

  validQuantity (val) {
    return Number.isInteger(val) && val >= 1 && val <= 10
  }

  buildQuery () {
    // Build query object
    const { quantity, direction, cabinClasses } = this
    const query = {
      fromCity: this.fromCity.toUpperCase(),
      toCity: this.toCity.toUpperCase(),
      quantity,
      direction,
      startDate: this.startDate.format('YYYY-MM-DD'),
      endDate: this.endDate.format('YYYY-MM-DD'),
      cabin: cabinClasses.join(',')
    }

    // Build query string
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      params.append(key, value)
    }
    return '/api/search?' + params.toString()
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