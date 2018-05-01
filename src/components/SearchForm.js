import React, { Component } from 'react'
import { inject, observer } from 'mobx-react'
import moment from 'moment'

import './SearchForm.css'

@inject('searchStore')
@observer
class SearchForm extends Component {
  constructor (props) {
    super(props)

    this.state = {
      fromCity: 'HKG',
      toCity: 'SIN',
      passengers: 1,
      direction: 'oneway',
      showWaitlisted: true,
      startDate: moment().format('YYYY-MM-DD'),
      endDate: moment().add(1, 'y').format('YYYY-MM-DD'),
      airlines: {}
    }

    this.handleInputChange = this.handleInputChange.bind(this)
  }

  handleInputChange ({ target }) {
    const value = target.type === 'checkbox' ? target.checked : target.value
    const name = target.name

    console.log("handing input change:", this.state)
    const { searchStore } = this.props
    this.setState(
      { [name]: value },
      () => { searchStore.search(this.state) }
    )
  }

  render () {
    const {
      fromCity,
      toCity,
      passengers,
      oneWay,
      showWaitlisted,
      startDate,
      endDate,
      airlines
    } = this.state

    return (
      <header className='theme-calendar section clearfix' id='calendarHeader'>
        <section className='section'>
          <h1>Search</h1>
          <hr />
          <form>
            <label>
              From:
              <input
                name='fromCity'
                type='text'
                value={fromCity}
                onChange={this.handleInputChange}
              />
            </label>
            <br />

            <label>
              To:
              <input
                name='toCity'
                type='text'
                value={toCity}
                onChange={this.handleInputChange}
              />
            </label>
            <br />

            <label>
              Passengers:
              <input
                name='passengers'
                type='number'
                value={passengers}
                onChange={this.handleInputChange}
              />
            </label>
            <br />

            <div>
              <input type='radio' id='oneWay' name='direction' value='oneway' />
              <label htmlFor='oneWay'>One-way</label>

              <input type='radio' id='roundTrip' name='direction' value='roundtrip' />
              <label htmlFor='roundTrip'>Round-trip</label>
            </div>

            <label>
              <input
                name='showWaitlisted'
                type='checkbox'
                checked={showWaitlisted}
                onChange={this.handleInputChange}
              />
              Show waitlisted awards
            </label>
            <br />

            <p>Search range</p>
            <label>
              Start:
              <input
                name='startDate'
                type='date'
                value={startDate}
                onChange={this.handleInputChange}
              />
            </label>
            <label>
              End:
              <input
                name='endDate'
                type='date'
                value={endDate}
                onChange={this.handleInputChange}
              />
            </label>

            <p>Airlines</p>
            <label>
              <input
                name='sq'
                type='checkbox'
                checked={airlines.sq}
                onChange={this.handleInputChange}
              />
              Singapore Airlines
            </label>
            <br />

          </form>
        </section>
      </header>
    )
  }
}

export default SearchForm
