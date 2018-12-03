import React, { Component } from 'react'
import { inject } from 'mobx-react'
import moment from 'moment'

import * as utilities from '../lib/utilities'

import './Awards.css'

// Theme
import theme from './theme.json'

@inject('configStore', 'searchStore')
class Awards extends Component {
  render () {
    // Check for empty data first
    const { data } = this.props
    if (!data) {
      return <div />
    }

    // Get date, and awards
    const { engineInfo, legend, fromCity } = this.props.searchStore
    const { date, awards } = data

    // Group awards into tables by engine
    const map = awards.reduce((map, x) => {
      const arr = map.get(x.engine) || []
      arr.push(x)
      map.set(x.engine, arr)
      return map
    }, new Map())

    // Group into arrivals and departures
    for (const [key, awards] of map) {
      map.set(key, awards.reduce((obj, x) => {
        ((x.fromCity === fromCity) ? obj.departures : obj.arrivals).push(x)
        return obj
      }, { departures: [], arrivals: [] }))
    }

    // Sort groups by website name
    const groups = [...map.entries()].map(x => {
      const { name } = engineInfo.get(x[0])
      const { departures, arrivals } = x[1]
      return { engine: x[0], name, departures, arrivals }
    }).sort((x, y) => utilities.strcmp(x.name, y.name))

    // Create array of tables (arrivals and departures)
    const tables = []
    for (const group of groups) {
      const { engine, name, departures, arrivals } = group

      // Compute the set of fare codes for this group
      const codes = [...departures, ...arrivals].reduce((set, award) => {
        award.fares.split(' ').forEach(x => set.add(x))
        return set
      }, new Set())

      // Get the ordered list of fares, filtered by what's available
      const fares = legend.find(x => (x.key === engine)).fares.filter(x => codes.has(x.key)).map(data => {
        const { key, index, waitlisted } = data
        const fare = engineInfo.get(engine).fares.find(x => (x.code === key.slice(0, -1)))
        const palette = waitlisted ? theme.awardWaitlisted : theme.award
        const color = palette[index % palette.length].fillColor
        return { name: fare.name, waitlisted, key, color }
      })

      // Add a table for each trip type
      tables.push({ engine, name, fares, type: 'Departures', awards: departures })
      tables.push({ engine, name, fares, type: 'Arrivals', awards: arrivals })
    }

    // Generate HTML markup
    return (
      <div>
        <h2>{date.format('ll')}</h2>
        {tables.length === 0 && <div className="no-results"><p>No award flights were found.</p></div>}
        {tables.map(table => this.renderTable(table))}
      </div>
    )
  }

  renderTable (table) {
    const { engine, name, fares, type, awards } = table

    // Group awards by itinerary
    const map = awards.reduce((map, x) => {
      const key = x.segments.map(x => x.flight).join('|')
      const arr = map.get(key) || []
      arr.push(x)
      map.set(key, arr)
      return map
    }, new Map())

    // Sort itineraries by total duration
    const itineraries = [...map.values()].map(awards => {
      let { segments, duration } = awards[0]

      // Determine highest class of service on each award flight
      const { cabins } = this.props.configStore
      const ord = cabins.map(x => x.value)
      const bestCabin = awards.map(x => ord.indexOf(x.cabin))

      // Compute mixed cabin status for each segment
      segments = segments.map((segment, i) => {
        const mixedSet = new Set()
        awards.forEach((award, j) => {
          const segmentCabin = ord.indexOf(award.segments[i].cabin)
          if (segmentCabin > bestCabin[j]) {
            mixedSet.add(ord[segmentCabin])
          }
        })
        const mixed = [...mixedSet.values()]
          .sort((a, b) => ord.indexOf(a) - ord.indexOf(b))
          .map(x => cabins.find(cabin => cabin.value === x).label)

        return { ...segment, mixed }
      })

      // Compute award fares for this itinerary
      const awardFares = fares.map(fare => {
        const matching = awards.filter(x => x.fares.split(' ').includes(fare.key))
        const quantity = matching.length ? Math.max(...matching.map(x => x.quantity)) : 0
        const mileage = (matching.length && matching.every((x, i, arr) => x.mileage === arr[0].mileage)) ? matching[0].mileage : null
        const mixed = !!matching.find(x => x.mixed)
        return { fare, quantity, mileage, mixed, segments }
      })

      return { awards, segments, awardFares, duration }
    }).sort((x, y) => (x.duration - y.duration))

    return (
      <table key={`${engine}-${type}`}>
        <thead>
          <tr>
            <td>
              <div className="heading">
                <img srcSet={`/images/airlines/${engine.toLowerCase()}_small.png,
                             /images/airlines/${engine.toLowerCase()}_small@2x.png 2x`}
                     src={`/images/airlines/${engine.toLowerCase()}_small.png`}
                     alt="Airline Logo" />
                <div>
                  <h2>{name}: {type}</h2>
                  <p>{itineraries.length} Itineraries, {awards.length} Awards Found</p>
                </div>
              </div>
            </td>
            {fares.map(fare => this.renderAwardHeader(fare))}
          </tr>
        </thead>
        <tbody>
          {itineraries.length === 0 && this.renderNoResults(fares)}
          {itineraries.map(itinerary => this.renderItinerary(itinerary))}
        </tbody>
      </table>
    )
  }

  renderAwardHeader (fare) {
    const { name, waitlisted, color, key } = fare
    return (
      <td
        className="award"
        style={{ backgroundColor: color }}
        key={`${key}-header`}
      >
        <p className="name">{name}</p>
        <p className="status">{waitlisted ? 'Waitlisted' : 'Available'}</p>
      </td>
    )
  }

  renderNoResults (fares) {
    return (
      <tr>
        <td className="trip">
          <div className="no-results">No award flights were found.</div>
        </td>
        {fares.map(fare => this.renderAwardFare({ fare, quantity: 0, segments: [] }))}
      </tr>
    )
  }

  renderItinerary (itinerary) {
    const { awards, segments, awardFares } = itinerary
    return (
      <tr key={segments.map(x => x.flight).join('-')}>
        <td className="trip">
          {segments.map((segment, idx) => this.renderSegment(segment, idx === 0 ? awards[0] : null))}
        </td>
        {awardFares.map(awardFare => this.renderAwardFare(awardFare))}
      </tr>
    )
  }

  renderSegment (segment, itinerary) {
    const { airline, flight, aircraft, mixed, departure, arrival, fromCity, toCity, duration, stops, lagDays } = segment
    const { airlines, engines } = this.props.configStore
    const logo = engines.find(x => x.id === airline) ? airline.toLowerCase() : 'zz'
    const airlineInfo = airlines.find(x => x.iata === airline)
    const airlineName = airlineInfo ? airlineInfo.name : airline

    return (
      <div className="flight" key={flight}>
        <div className="overview">
          <img srcSet={`/images/airlines/${logo}_small.png,
                       /images/airlines/${logo}_small@2x.png 2x`}
               src={`/images/airlines/${logo}_small.png`}
               alt="Airline Logo" />
          <p>
            {!itinerary && ' '}
            {itinerary && itinerary.stops === 0 && 'Non-Stop'}
            {itinerary && itinerary.stops === 1 && '1 Stop'}
            {itinerary && itinerary.stops > 1 && `${itinerary.stops} Stops`}
          </p>
          <p className="duration">
            {itinerary ? this.formatDuration(itinerary.duration) : ' '}
          </p>
        </div>
        <div className="identifier">
          <h1>{flight}</h1>
          <p>{airlineName}</p>
          <p>{aircraft}</p>
          {mixed.length > 0 && <p><span role="img" aria-label="warning">⚠️</span> <em>{mixed.join(', ')}</em></p>}
        </div>
        <div className="schedule">
          <div className="times">
            <div className="departure">
              {moment.utc(departure, 'HH:mm', true).format('h:mma')}
            </div>
            <div className="arrival">
              {moment.utc(arrival, 'HH:mm', true).format('h:mma')}
              {lagDays > 0 && <div className="lag">+{lagDays}</div>}
            </div>
          </div>
          <div className="cities">
            <p className="origin">{fromCity}</p>
            <p className="duration">
              {this.formatDuration(duration)}
              {stops === 1 && ', 1 Stop'}
              {stops > 1 && `, ${stops} Stops`}
            </p>
            <p className="destination">{toCity}</p>
          </div>
        </div>
      </div>
    )
  }

  renderAwardFare (award) {
    const { fare, quantity, mileage, mixed, segments } = award
    const innerHTML = quantity > 0
      ? (
          <div>
            <h1>{quantity}x</h1>
            <h2>
              {mileage === null ? '' : mileage.toLocaleString()}
              {mixed && <div className="warning"><span role="img" aria-label="warning">⚠️</span><br /><em>Mixed Cabin</em></div>}
            </h2>
          </div>
        )
      : <p>Not Available</p>
    return (
      <td
        className="award"
        style={{ backgroundColor: fare.color }}
        key={[fare.key, ...segments.map(x => x.flight)].join('-')}
      >
        {innerHTML}
      </td>
    )
  }

  formatDuration (val) {
    return (val < 60)
      ? `${val}m`
      : `${Math.floor(val / 60)}h ${val % 60}m`
  }
}

export default Awards
