import { observable, computed, action, autorun } from 'mobx'
import moment from 'moment'
import URLSearchParams from 'url-search-params'

import * as utils from '../lib/utilities'

function flightKey(flight) {
  return JSON.stringify(flight, ['airline', 'flight', 'aircraft'])
}

export default class SearchStore {
  // Query parameters
  @observable fromCity
  @observable toCity
  @observable showPartner
  @observable showWaitlisted
  @observable showNonSaver
  @observable maxStops
  @observable quantity
  @observable direction
  @observable cabinClasses
  @observable showMixedCabin
  @observable startDate
  @observable endDate
  @observable selectedAirlines = observable.map()
  @observable selectedFlights = observable.map()

  // Search state
  @observable loading = false
  _results = observable.array([], {deep: false})

  constructor (configStore) {
    this.configStore = configStore

    // Load saved settings from local storage
    this.loadSettings()

    // Execute search query whenever it is updated, and valid
    autorun(() => {
      if (this.validQuery()) {
        this.search(this.buildQuery())
      }
    })
  }

  // Results, filtered by cabin classes / options
  @computed get results () {
    const { showPartner, showWaitlisted, showNonSaver, showMixedCabin, maxStops } = this
    const { configStore } = this
    
    // Check if config is loaded yet
    if (configStore.loading) {
      return []
    }

    // Keep a map of fare info for faster lookup
    const fareInfo = new Map()
    configStore.engines.forEach((airline) => {
      const { id, fares } = airline
      fareInfo.set(id, fares.reduce((map, fare) => {
        map.set(fare.code, fare)
        return map
      }, new Map()))
    })

    // Filter results
    return this._results
      .filter(result => (
        (showPartner || result.partner === 0) &&
        (showMixedCabin || result.mixed === 0) &&
        (maxStops < 0 || result.stops <= maxStops)
      ))
      .map(result => {
        let { engine, fares } = result
        const map = fareInfo.get(engine)

        if (fares.length > 0) {
          fares = fares.split(' ').filter(code => {
            const fare = map.get(code.slice(0, -1))
            return (
              (showNonSaver || fare.saver) &&
              (showWaitlisted || !code.includes('@'))
            )
          }).join(' ')
        }

        result.segments.forEach(x => x.aircraft = x.aircraft || 'Unknown Aircraft')
        return { ...result, fares }
      })
  }

  // Results, filtered by selected airlines / flights
  @computed get awards () {
    // Results for filtered airlines are removed completely, while results
    // for filtered flights have their awards cleared
    const filteredByAirline = (result) => {
      return !result.segments.find(x => !this.getAirline(x.airline))
    }
    const filteredByFlight = (result) => {
      return !result.segments.find(x => !this.getFlight(x))
    }
    const mapedFlight = (result) => {
      return (result.segments.find(x => !this.getFlight(x)))
        ? { ...result, fares: '' }
        : result
    }
    return this.results
      .filter(x => filteredByAirline(x))
      .filter(x => filteredByFlight(x))
      .map(x => mapedFlight(x))
  }

  @computed get aircraftInfo () {
    const map = new Map()
    const { aircraft } = this.configStore
    if (aircraft) {
      for (const plane of aircraft) {
        if (plane.iata) {
          map.set(plane.iata, plane.name)
        }
        if (plane.icao) {
          map.set(plane.icao, plane.name)
        }
      }
    }
    return map
  }

  @computed get airlineInfo () {
    const map = new Map()
    const { airlines } = this.configStore
    if (airlines) {
      for (const airline of airlines) {
        map.set(airline.iata, airline)
      }
    }
    return map
  }

  @computed get engineInfo () {
    const map = new Map()
    const engines = this.configStore.engines
    if (engines) {
      for (const engine of engines) {
        map.set(engine.id, engine)
      }
    }
    return map
  }

  @computed get flights () {
    const { aircraftInfo } = this
    const segments = this.results.reduce((arr, award) => arr.concat(award.segments), [])
    const map = new Map()
    for (const segment of segments) {
      let f = {
        airline: segment.airline,
        flight: segment.flight,
        aircraft: aircraftInfo.get(segment.aircraft) || segment.aircraft || 'Unknown Aircraft'
      }
      map.set([f.airline, f.flight, f.aircraft].join('|'), f)
    }
    return [...map.values()].sort((x, y) => utils.strcmp(x.flight, y.flight, x.aircraft, y.aircraft))
  }

  @computed get airlines () {
    const { airlineInfo } = this
    let ret = new Set([...this.flights.map(x => x.airline).filter(x => !!x)])
    ret = [...ret.values()].map(x => (
      { code: x, name: airlineInfo.has(x) ? airlineInfo.get(x).name : x }
    ))
    ret.sort((x, y) => utils.strcmp(x.name, y.name))
    return ret
  }

  // Build a legend, mapping fare codes to colors
  @computed get legend () {
    const map = new Map()
    const { engineInfo } = this

    for (const award of this.awards) {
      const { engine } = award
      const { website, fares } = engineInfo.get(engine)

      // If empty, skip
      if (award.fares.length === 0) {
        continue
      }

      // Initialize the data for an airline
      if (!map.has(engine)) {
        map.set(engine, {
          key: engine, name: website, fares, awards: new Set()
        })
      }

      // Add the award
      const { awards } = map.get(engine)
      award.fares.split(' ').forEach(code => {
        awards.add(code.slice(0, -1))
      })
    }

    // Sort airlines and fares, and assign colors
    let idx = 0
    const legend = [...map.values()].sort((x, y) => utils.strcmp(x.name, y.name))
    for (const data of legend) {
      // Generate sorted list of awards, based on search results
      const { fares, awards } = data
      data.fares = []
      for (const fare of fares) {
        const { code, name } = fare

        // If we don't have awards for this fare, just increment the palette index and move on
        if (!awards.has(code)) {
          idx++
          continue
        }

        // Add an entry to the legend
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
      if (flight.airline === airline.code) {
        this.selectedFlights.set(flightKey(flight), val)
      }
    }
  }

  @action toggleFlight(flight) {
    const { selectedFlights: sel } = this
    const key = flightKey(flight)
    const val = sel.has(key) ? !sel.get(key) : false
    sel.set(key, val)

    // Propagate to airlines
    const { flights } = this
    const context = this
    this.airlines
      .map(x => x.code)
      .forEach(x => {
        const isAirlineSelected = flights.filter(y => y.airline === x).some(z => context.getFlight(z))
        context.selectedAirlines.set(x, isAirlineSelected)
      })

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
    return (airline && sel.has(airline)) ? sel.get(airline) : true
  }

  getFlight (flight) {
    const { selectedFlights: sel } = this
    const key = flightKey(flight)
    return (flight.flight && sel.has(key)) ? sel.get(key) : true
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
    // Save the query parameters to local storage
    this.saveSettings()

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

  loadSettings () {
    const defaults = {
      fromCity: '',
      toCity: '',
      showPartner: true,
      showWaitlisted: true,
      showNonSaver: true,
      quantity: 1,
      maxStops: -1,
      direction: 'roundtrip',
      cabinClasses: ['first'],
      showMixedCabin: true,
      startDate: moment().startOf('day'),
      endDate: moment().startOf('day').add(1, 'year')
    }
    for (const [key, defaultVal] of Object.entries(defaults)) {
      let val = localStorage.getItem(key)
      if (val) {
        switch (key) {
          case 'fromCity':
          case 'toCity':
            val = (typeof val === 'string') ? val : defaultVal
            break
          case 'showPartner':
          case 'showWaitlisted':
          case 'showNonSaver':
          case 'showMixedCabin':
            val = utils.coerceBoolean(val, defaultVal)
            break
          case 'quantity':
            val = utils.coerceNumber(val, defaultVal);
            break
          case 'maxStops':
            val = utils.coerceNumber(val, defaultVal);
            break
          case 'direction':
            val = ['roundtrip', 'oneway'].includes(val) ? val : defaultVal
            break
          case 'cabinClasses':
            try {
              val = JSON.parse(val)
            } catch (err) {
              val = defaultVal
            }
            break
          case 'startDate':
            val = moment(val, 'YYYY-MM-DD', true)
            val = (val.isValid() && val.isSameOrAfter(defaultVal)) ? val : defaultVal
            break
          case 'endDate':
            val = moment(val, 'YYYY-MM-DD', true)
            val = (val.isValid() && val.isSameOrBefore(defaultVal)) ? val : defaultVal
            break
          default:
            val = defaultVal
        }
      } else {
        val = defaultVal
      }
      this[key] = val
    }
  }

  saveSettings () {
    [
      'fromCity',
      'toCity',
      'showPartner',
      'showWaitlisted',
      'showNonSaver',
      'quantity',
      'maxStops',
      'direction',
      'cabinClasses',
      'showMixedCabin',
      'startDate',
      'endDate'
    ].forEach((key) => {
      let val = this[key]
      switch (key) {
        case 'cabinClasses':
          val = JSON.stringify(val)
          break
        case 'startDate':
        case 'endDate':
          val = val.format('YYYY-MM-DD')
          break
        default:
      }
      localStorage.setItem(key, val)
    })
  }
}
