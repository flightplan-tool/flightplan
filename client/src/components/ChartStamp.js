import React, { Component } from 'react'
import { inject, observer } from 'mobx-react'
import Spinner from 'react-spinkit'

import './ChartStamp.css'

@inject('searchStore')
@observer
class ChartStamp extends Component {
  render () {
    const { searchStore } = this.props

    if (searchStore.loading) {
      return <Spinner
        className='chart-stamp-loader'
        name="ball-scale-ripple-multiple"
        color="white" fadeIn="none"
      />
    }

    return <img
      className='chart-stamp'
      alt='Flightplan Logo'
      src={`/images/flightplan-logo.svg`}
    />
  }
}

export default ChartStamp
