import React, { Component } from 'react'
import { inject, observer } from 'mobx-react'
import moment from 'moment'
import DatePicker from 'react-datepicker'
import Select from 'react-select'

import CheckBox from './controls/CheckBox'
import RadioButton from './controls/RadioButton'

import './SearchForm.css'
import 'react-datepicker/dist/react-datepicker.css'

@inject('searchStore')
@observer
class SearchForm extends Component {
  swapCities () {
    const { searchStore } = this.props

    const { fromCity, toCity } = searchStore
    searchStore.update({ fromCity: toCity, toCity: fromCity })
  }

  render () {
    const { searchStore } = this.props
    const passengerOptions = [...Array(10).keys()].map(x => ({ value: x + 1, label: (x + 1).toString() }))
    const stopsOptions = [
      {value: -1, label: 'Any number of stops'},
      {value: 0, label: 'Nonstop only'},
      {value: 1, label: '1 stop or fewer'},
      {value: 2, label: '2 stops or fewer'},
      {value: 3, label: '3 stops or fewer'},
      {value: 4, label: '4 stops or fewer'},
      {value: 5, label: '5 stops or fewer'}
    ]

    return (
      <form className='searchForm'>
        <h1>Search</h1>
        <fieldset className='cities'>
          <div className='grid'>
            <label style={{ gridArea: 'fromLabel' }}>From</label>
            <div style={{ gridArea: 'fromCity' }}>
              <input
                name='fromCity'
                type='text'
                value={searchStore.fromCity}
                onFocus={(e) => e.target.select()}
                onChange={(e) => { searchStore.update({ fromCity: e.target.value }) }}
              />
              <img
                className='double-arrows'
                alt='Swap From / To'
                src={`/images/double-arrows.svg`}
                onClick={() => this.swapCities()}
              />
            </div>
            <label style={{ gridArea: 'toLabel' }}>To</label>
            <input
              name='toCity'
              type='text'
              value={searchStore.toCity}
              onFocus={(e) => e.target.select()}
              onChange={(e) => { searchStore.update({ toCity: e.target.value }) }}
              style={{ gridArea: 'toCity' }}
            />
            <RadioButton
              label='One-Way'
              checked={ searchStore.direction === 'oneway' }
              onChange={(e) => { searchStore.update({ direction: e.target.checked ? 'oneway' : 'roundtrip' }) }}
              style={{ gridArea: 'oneWay' }}
            />
            <RadioButton
              label='Round-Trip'
              checked={ searchStore.direction === 'roundtrip' }
              onChange={(e) => { searchStore.update({ direction: e.target.checked ? 'roundtrip' : 'oneway' }) }}
              style={{ gridArea: 'roundTrip' }}
            />
          </div>
        </fieldset>

        <fieldset className='dates'>
          <div className='grid'>
            <label style={{ gridArea: 'startLabel' }}>Start Date</label>
            <DatePicker
              name='startDate'
              selected={searchStore.startDate}
              minDate={moment()}
              maxDate={searchStore.endDate}
              monthsShown={2}
              fixedHeight
              onChange={(val) => searchStore.update({ startDate: val })}
              style={{ gridArea: 'startDate' }}
            />
            <label style={{ gridArea: 'endLabel' }}>End Date</label>
            <DatePicker
              name='endDate'
              selected={searchStore.endDate}
              minDate={searchStore.startDate}
              maxDate={moment().add(1, 'y')}
              monthsShown={2}
              fixedHeight
              onChange={(val) => searchStore.update({ endDate: val })}
              style={{ gridArea: 'endDate' }}
            />
          </div>
        </fieldset>

        <fieldset className='cabins'>
          <h4>Cabin Classes</h4>

          <div className='grid'>
            <CheckBox
              label='First'
              checked={searchStore.getClass('first')}
              onChange={(e) => { searchStore.toggleClass('first') }}
              style={{ gridArea: 'firstClass' }}
            />

            <CheckBox
              label='Business'
              checked={searchStore.getClass('business')}
              onChange={(e) => { searchStore.toggleClass('business') }}
              style={{ gridArea: 'businessClass' }}
            />

            <CheckBox
              label='Prem. Economy'
              checked={searchStore.getClass('premium')}
              onChange={(e) => { searchStore.toggleClass('premium') }}
              style={{ gridArea: 'premEconClass' }}
            />

            <CheckBox
              label='Economy'
              checked={searchStore.getClass('economy')}
              onChange={(e) => { searchStore.toggleClass('economy') }}
              style={{ gridArea: 'econClass' }}
            />

            <CheckBox
              label='Include Mixed Cabin Awards'
              checked={searchStore.showMixedCabin}
              onChange={(e) => { searchStore.update({ showMixedCabin: e.target.checked }) }}
              style={{ gridArea: 'showMixedCabin' }}
            />

            <label style={{ gridArea: 'passengersLabel' }}>Passengers</label>
            <div style={{ gridArea: 'passengers' }}>
              <Select
                name='passengers'
                defaultValue={passengerOptions.find(x => x.value === searchStore.quantity)}
                onChange={(e) => { searchStore.update({ quantity: e.value }) }}
                options={passengerOptions}
                styles={{
                  control: (base, state) => ({
                    ...base,
                    fontSize: '13px',
                    height: '25px',
                    width: '105px',
                  }),
                  option: (base, state) => ({
                    ...base,
                    fontSize: '13px'
                  }),
                  menu: (base, state) => ({
                    ...base,
                    width: '105px'
                  }),
                }}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className='options'>
          <div className='grid'>
            <CheckBox
              label='Include Partner Awards'
              checked={searchStore.showPartner}
              onChange={(e) => { searchStore.update({ showPartner: e.target.checked }) }}
              style={{ gridArea: 'showPartner' }}
            />

            <CheckBox
              label='Include Waitlisted Awards'
              checked={searchStore.showWaitlisted}
              onChange={(e) => { searchStore.update({ showWaitlisted: e.target.checked }) }}
              style={{ gridArea: 'showWaitlisted' }}
            />

            <CheckBox
              label='Include Non-Saver Awards'
              checked={searchStore.showNonSaver}
              onChange={(e) => { searchStore.update({ showNonSaver: e.target.checked }) }}
              style={{ gridArea: 'showNonSaver' }}
            />

            <label style={{ gridArea: 'stopsLabel' }}>Stops</label>
            <div style={{ gridArea: 'stops' }}>
              <Select
                name='stops'
                defaultValue={stopsOptions.find(x => x.value === searchStore.maxStops)}
                onChange={(e) => { searchStore.update({ maxStops: e.value }) }}
                options={stopsOptions}
                isSearchable={false}
                styles={{
                  control: (base, state) => ({
                    ...base,
                    fontSize: '13px',
                    height: '25px',
                    width: '187px',
                  }),
                  option: (base, state) => ({
                    ...base,
                    fontSize: '13px'
                  }),
                  menu: (base, state) => ({
                    ...base,
                    width: '187px'
                  }),
                }}
              />
            </div>
          </div>
        </fieldset>

        {this.renderAirlines()}        
        {this.renderFlights()}
        {this.renderResultCount()}
      </form>
    )
  }

  renderAirlines () {
    const { searchStore } = this.props
    const elements = searchStore.airlines.map(airline => (
      <CheckBox
        key={airline.code}
        label={airline.name}
        checked={searchStore.getAirline(airline.code)}
        onChange={() => { searchStore.toggleAirline(airline) }}
      />
    ))
    
    if (elements.length === 0) {
      return null
    }

    return (
      <fieldset className='airlines'>
        <h2>Airlines</h2>
        {elements}  
      </fieldset>
    )
  }

  renderFlights () {
    const { searchStore } = this.props
    const elements = searchStore.flights.map(flight => (
      <CheckBox
        key={JSON.stringify(flight, ['flight', 'aircraft'])}
        checked={searchStore.getFlight(flight)}
        onChange={() => { searchStore.toggleFlight(flight) }}
      >
        {flight.flight}: <em>{flight.aircraft}</em>
      </CheckBox>
    ))
    
    if (elements.length === 0) {
      return null
    }

    return (
      <fieldset className='flights'>
        <h2>Flights</h2>
        {elements}  
      </fieldset>
    )
  }

  renderResultCount () {
    const { searchStore } = this.props
    const { awards, engineInfo } = searchStore

    let total = 0
    const counts = new Map()
    for (const award of awards) {
      // Get counts for airline
      const { engine, fares } = award
      if (!counts.has(engine)) {
        counts.set(engine, new Map())
      }
      const subCounts = counts.get(engine)

      // Update for each fare code
      if (fares.length > 0) {
        for (const code of fares.split(' ')) {
          const count = subCounts.has(code) ? subCounts.get(code) : 0
          subCounts.set(code, count + 1)
          total++
        }
      }
    }

    // Convert count map to an array
    const entries = []
    for (const engine of [...counts.keys()].sort()) {
      const subCounts = counts.get(engine)
      const awards = new Set([...subCounts.keys()].map(x => x.slice(0, -1)))
      const fares = engineInfo.get(engine).fares
      for (const fare of fares.filter(x => awards.has(x.code))) {
        for (const code of [fare.code + '+', fare.code + '@']) {
          if (subCounts.has(code)) {
            let codeLbl = fare.name
            codeLbl += code.includes('@') ? ' Waitlisted' : ''
            codeLbl += ` (${code})`

            entries.push(
              <p key={engine + '|' + code}>
                {engine + ' ' + codeLbl}:{' '}
                <em>{subCounts.get(code)}</em>
              </p>
            )
          }
        }
      }
    }

    return (
      <fieldset className='resultCount'>
        <h2>Results</h2>
        <p>Total Awards: <em>{total}</em></p>
        {entries}
      </fieldset>
    )
  }
}

export default SearchForm
