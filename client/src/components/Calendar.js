import React, { Component } from 'react'
import { inject, observer } from 'mobx-react'

import Chart from './Chart'
import ChartLabels from './ChartLabels'
import ChartStamp from './ChartStamp'

import './Calendar.css'

@inject('searchStore')
@observer
class Calendar extends Component {
  render () {
    return (
      <div className='chart-rings-container'>
        <div className='chart-rings-inside'>
          <ChartLabels />
          <ChartStamp />
        </div>
        <div className='chart-rings-inside'>
          <Chart />
        </div>
      </div>
    )
  }
}

export default Calendar
