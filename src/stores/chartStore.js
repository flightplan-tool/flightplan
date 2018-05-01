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

  /**
   * Colours ring segment based on focus state
   */
  focusEvent (monthIndex, dayIndex, isFocused) {
    dayIndex = (dayIndex + this.getStartIndex(monthIndex))
    this.focusSegment(monthIndex, dayIndex, isFocused)
  }

  focusSegment (monthIndex, dayIndex, isFocused) {
    // Update row focus
    d3.select('g.chart-ring-' + monthIndex)
      .selectAll('path')
      .transition()
      .duration(150)
      .attr('fill', (d, i) => {
        var fillColour = d.data.fillColor

        if (isFocused) {
          if (d.data.isActive && !d.data.isEvent && !d.data.isCurrentDay) {
            fillColour = utilities.shadeColor(d.data.fillColor, -0.5)
          }
        }

        return fillColour
      })

    // Update segment color
    d3.select('g.chart-ring-' + monthIndex)
      .select('.segment-' + dayIndex)
      .transition()
      .duration(150)
      .attr('fill', (d, i) => {
        var fillColor = d.data.fillColor

        if (isFocused) {
          if (d.data.isEvent) {
            fillColor = this.config.defaults.EVENT_FILL_HIGHLIGHT
          } else if (d.data.isCurrentDay) {
            fillColor = this.config.defaults.CURRENT_DAY_FILL_HIGHLIGHT
          } else {
            fillColor = this.config.defaults.SEGMENT_FILL_HIGHLIGHT
          }
        }

        return fillColor
      })

    // Update text color
    d3.select('g.chart-ring-' + monthIndex)
      .select('.segment-label-' + dayIndex)
      .select('text')
      .transition()
      .duration(150)
      .style('fill', (d, i) => {
        var textColor = d.data.textColor

        if (isFocused) {
          if (d.data.isEvent) {
            textColor = this.config.defaults.EVENT_TEXT_HIGHLIGHT
          } else if (d.data.isCurrentDay) {
            textColor = this.config.defaults.CURRENT_DAY_TEXT_HIGHLIGHT
          } else {
            textColor = this.config.defaults.SEGMENT_TEXT_HIGHLIGHT
          }
        }

        return textColor
      })
  }

  getStartIndex (index) {
    return this.config.calendar[index].startIndex
  }
}
