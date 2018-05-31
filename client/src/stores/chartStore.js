import * as d3 from 'd3'
import moment from 'moment'

import * as utilities from '../lib/utilities'

export default class ChartStore {
  config = {
    defaults: {},
    calendar: {},
    chart: {},
    events: {}
  }

  setCalendarConfig(calendar) {
    this.config.calendar = calendar
  }

  setChartConfig(chart) {
    this.config.chart = chart
  }

  setEventsConfig(events) {
    this.config.events = events
  }

  setDefaultsConfig(defaults) {
    this.config.defaults = defaults
  }

  getMonth (year, month) {
    return this.config.chart[utilities.getMonthIndex(month)].filter(x => x.isActive)
  }

  getDay (year, month, day) {
    return this.config.chart[utilities.getMonthIndex(month)].find(x => x.day === day)
  }

  /// ///////////////////////////////////////////////////////////////////
  // MARKERS
  /// ///////////////////////////////////////////////////////////////////

  markCurrentDay () {
    var currentMonth = parseInt(moment().format('M'), 10) - 1
    var currentDay = parseInt(moment().format('D'), 10) - 1
    var day = this.config.chart[currentMonth][currentDay + this.getStartIndex(currentMonth)]

    day.fillColor = this.config.defaults.CURRENT_DAY_FILL_BASE
    day.textColor = this.config.defaults.CURRENT_DAY_TEXT_BASE
    day.isCurrentDay = true
  }

  markEvents () {
    this.config.events.forEach((event, eventIndex) => {
      var eventMonth = parseInt(moment(event.date).format('M'), 10) - 1
      var eventDay = parseInt(moment(event.date).format('D'), 10) - 1
      var day = this.config.chart[eventMonth][eventDay + this.getStartIndex(eventMonth)]

      if (!day.isCurrentDay) {
        day.fillColor = this.config.defaults.EVENT_FILL_BASE
        day.textColor = this.config.defaults.EVENT_TEXT_BASE
      }

      day.isEvent = true
    })
  }

  /// ///////////////////////////////////////////////////////////////////
  // HELPERS
  /// ///////////////////////////////////////////////////////////////////

}
