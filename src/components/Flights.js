import React, { Component } from 'react'
import { inject, observer } from 'mobx-react'

import './Flights.css'

@inject('searchStore')
@observer
class Flights extends Component {
  render () {
    const { searchStore } = this.props

    const flights = new Map()
    searchStore.awards.forEach(award => {
      flights.set(award.flight, award.aircraft)
    })
    const listItems = [...flights.keys()].sort().map(flight => (
      <li key={flight}><a href='/'>{flight} <span>{flights.get(flight)}</span></a></li>
    ))

    return (
      <div className='federal-holidays'>
        <hr />
        <h4>Flights</h4>
        <ul className='events'>
          {listItems}
        </ul>
      </div>
    )
  }
}

export default Flights