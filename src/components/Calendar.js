import React, { Component } from 'react'
import { inject, observer } from 'mobx-react'
import moment from 'moment'

import Chart from './Chart'
import ChartLabels from './ChartLabels'
import ChartStamp from './ChartStamp'

import './Calendar.css'

@inject('searchStore')
@observer
class Calendar extends Component {
  render () {
    // return (
    //   <div className='calendar'>
    //     <ChartLabels>
    //       <ChartStamp config={theme.stamp} />
    //     </ChartLabels>
    //     <div className='chart-rings-container'>
    //       <Chart config={config} />
    //     </div>
    //     <div className='ui-view-container ui-view-month animate-view-fade' />
    //   </div>
    // )

    return (
      <React.Fragment>
        <div className='chart-rings-container'>
          <div className='chart-rings-inside'>
            <Chart />
          </div>
        </div>
        <div className='ui-view-container ui-view-month animate-view-fade' />
      </React.Fragment>
    )
  }
}

export default Calendar
