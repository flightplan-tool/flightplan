import React, { Component } from 'react'
import { inject, observer } from 'mobx-react'
import moment from 'moment'

import SearchForm from './SearchForm'
import Chart from './Chart'
import ChartLabels from './ChartLabels'
import ChartStamp from './ChartStamp'
import Flights from './Flights'

import './Calendar.css'

@inject('searchStore')
@observer
class Calendar extends Component {
  componentDidMount () {
    const { year = 2015 } = this.props
    document.body.classList.toggle('theme-' + this.getThemeYear(year), true)
  }

  componentWillReceiveProps (nextProps) {
    const { oldYear = 2015 } = this.props
    const { newYear = 2015 } = nextProps
    document.body.classList.toggle('theme-' + this.getThemeYear(oldYear), false)
    document.body.classList.toggle('theme-' + this.getThemeYear(newYear), true)
  }

  componentWillUnmount () {
    const { year = 2015 } = this.props
    document.body.classList.toggle('theme-' + this.getThemeYear(year), false)
  }

  getCalendar (year, theme) {
    // Calculate start day index of month
    const calendar = require('../config/calendar.json')
    calendar.forEach((item, index) => {
      item.startIndex = this.getStartDay(index, year)
    })

    // Calculate days in February
    calendar[1].days = this.getDaysInFebruary(year)

    // merge theme
    theme.months.forEach((item, index) => {
      calendar[index] = {...calendar[index], ...item}
    })

    return calendar
  }

  getThemeYear (year) {
    // Choose a valid theme based on year
    const themes = ['2012', '2013', '2015']
    const currentYear = String(year)
    if (themes.indexOf(currentYear) > -1) {
      return currentYear
    }
    return '2015'
  }

  render () {
    const { year = 2015, searchStore } = this.props
    const themeYear = this.getThemeYear(year)

    // Format events
    const awards = searchStore.awards.map(award => ({
      label: `${award.flight}: ${award.fareCodes}`,
      date: moment(award.date).set('y', 2015).format('YYYY-MM-DD')
    }))

    // Load theme
    const theme = require('../config/themes/theme-' + themeYear + '.json')

    const config = {
      year,
      calendar: this.getCalendar(year, theme),
      defaults: theme.defaults,
      events: awards,
      currentDate: this.getCurrentDay()
    }

    return (
      <div
        id='calendarView' className='container'
        style={{background: 'linear-gradient(#060B1F, #121D52)'}}
      >
        <section>
          <aside>
            <SearchForm />
            <Flights />
          </aside>

          <article>
            <div className='calendar'>
              <ChartLabels>
                <ChartStamp config={theme.stamp} />
              </ChartLabels>
              <div className='chart-rings-container'>
                <Chart config={config} />
              </div>
            </div>
          </article>
        </section>

        <div className='ui-view-container ui-view-month animate-view-fade' />
      </div>
    )
  }

  getDaysInFebruary (year) {
    return new Date(year, 2, 0).getDate()
  }

  getStartDay (month, year) {
    return new Date(year, month, 0).getDay()
  }

  getCurrentDay () {
    var today = new Date()
    var dd = today.getDate()
    var mm = today.getMonth() + 1
    var yyyy = today.getFullYear()

    return (yyyy + '-' + mm + '-' + dd)
  }
}

export default Calendar
