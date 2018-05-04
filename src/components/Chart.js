import React, { Component } from 'react'
import { autorun } from 'mobx'
import { inject } from 'mobx-react'
import * as d3 from 'd3'

import * as utilities from '../lib/utilities'

import './Chart.css'

// Theme
import theme from './theme.json'

// Constants
const DURATION = 1000
const OFFSET = 22

@inject('calendarStore', 'searchStore')
class Chart extends Component {
  componentDidMount () {
    const { data } = this.props.calendarStore
    this.applyTheme(data)
    this.createChart(data)

    // Create an autorun, that automatically updates segment colors
    // based on underlying mobx data store
    autorun(() => {
      const { data } = this.props.calendarStore
      this.applyTheme(data)
      this.updateChart(data)
    })

    this.animateIn()
  }

  shouldComponentUpdate () {
    return false
  }

  render () {
    return <div className='chart' ref={(x) => { this._ref = x }} />
  }

  // Apply theme colors to the data before transforming to SVG
  applyTheme(data) {
    // Load legend, so we know what colors to apply to awards
    for (const month of data) {
      for (const segment of month) {
        // Apply style to segment
        const style = this.segmentStyle(segment)
        const { fillColor = '', textColor = '' } = style
        segment.fillColor = fillColor
        segment.textColor = textColor

        // Tint the weekends
        const { award, type, isWeekend } = segment
        if (!award && isWeekend && (type === 'search' || type === 'segment')) {
          segment.fillColor = utilities.shadeColor(segment.fillColor, -0.3)
        }
      }
    }
  }

  segmentStyle (segment) {
    const { award, date, type } = segment

    if (award) {
      const { legend } = this.props.searchStore
      const { airline, fareCodes } = award

      // Find the legend section that corresponds to this award's airline
      const section = legend.find(x => x.key === airline)
      if (section) {
        const match = section.fareCodes.find(x => fareCodes.has(x.key))
        if (match) {
          const { index, waitlisted } = match
          const palette = waitlisted ? theme.awardWaitlisted : theme.award
          return palette[index % palette.length]
        }
      }
    }
    if (type in theme) {
      return theme[type]
    }
    if (date) {
      return theme.months[date.month()]
    }
    return {fillColor: 'none'}
  }

  createChart (data) {
    const baseUnit = 1000
    const size = baseUnit - (2 * OFFSET)
    this.innerRadius = ((baseUnit / 2) - 20)
    this.outerRadius = (baseUnit / 2)

    this.pie = d3.pie()
      .padAngle(0.005)
      .value((d) => {
        return d.count
      }).sort(null)

    this.chartRing = d3.select(this._ref).append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .style('margin-top', (OFFSET / 2) + 'px')
      .style('margin-left', (OFFSET / 2) + 'px')
      .attr('class', 'calendar-chart-ring')
      .attr('viewBox', '0 0 ' + size + ' ' + size)
      .append('g')
      .attr('transform', 'translate(' + size / 2 + ',' + size / 2 + ')')
      .call(() => this.addSegments(data))
  }

  addSegments (data) {
    data.forEach((month, index) => {
      this.innerRadius -= OFFSET
      this.outerRadius -= OFFSET

      const arc = d3.arc()
        .innerRadius(this.innerRadius)
        .outerRadius(this.outerRadius)

      const group = d3.select(this._ref).select('g')
        .append('g')
        .attr('class', (d, i) => {
          return 'chart-ring chart-ring-' + index
        })

      // Configure segment color
      group.selectAll('path')
        .data(this.pie(month))
        .enter()
        .append('path')
        .attr('d', arc)
        .attr('class', (d, i) => {
          return 'segment segment-' + i
        })
        .attr('fill', (d) => d.data.fillColor)
        .on('mouseover', (d) => {
          if (d.data.date) {
            var monthIndex = d.data.index
            var dayIndex = d.data.date.date() - 1
            this.focusEvent(monthIndex, dayIndex, true)
          }
        })
        .on('mouseout', (d) => {
          if (d.data.date) {
            var monthIndex = d.data.index
            var dayIndex = d.data.date.date() - 1
            this.focusEvent(monthIndex, dayIndex, false)
          }
        })
        .on('click', (d) => {
          console.log('You clicked:', d.data)
          // if (d.data.date) {
          //   $state.go('calendar.month.day', {
          //     day: d.data.day,
          //     month: d.data.month
          //   })
          // }
        })

      this.addMonthLabels(group, index)
      this.addDayLabels(group, month, arc, index)
    })
  }

  addMonthLabels (group, index) {
    const { calendar } = this.props.calendarStore

    // Configure month labels
    group.selectAll('g.month-label')
      .data([calendar[index].monthLabel])
      .enter()
      .append('g')
      .attr('class', 'month-label')
      .append('text')
      .style('text-anchor', 'end')
      .attr('dx', '-20')
      .attr('dy', (this.outerRadius * -1) + 13)
      .style('fill', theme.monthLabel.textColor)
      .text((d, i) => d)
  }

  addDayLabels (group, month, arc, index) {
    // Configure day labels
    group.selectAll('g.segment-label')
      .data(this.pie(month))
      .enter()
      .append('g')
      .attr('class', (d, i) => {
        return 'segment-label segment-label-' + i
      })
      .append('text')
      .attr('pointer-events', 'none')
      .attr('transform', (d) => {
        // set the label's origin to the center of the arc
        // we have to make sure to set these before calling arc.centroid
        d.outerRadius = this.outerRadius + 50
        d.innerRadius = this.outerRadius + 45
        return 'translate(' + arc.centroid(d) + ')'
      })
      .attr('text-anchor', 'middle')
      .attr('dy', 3)
      .style('fill', (d, i) => d.data.textColor)
      .text((d, i) => d.data.text)
  }

  // Update the chart segment colors based on dataset
  updateChart (data) {
    data.forEach((month, index) => {
      d3.select(this._ref)
        .select('g.chart-ring-' + index)
        .selectAll('path')
        .data(this.pie(month))
        .transition()
        .duration(DURATION / 2)
        .delay(index * 50)
        .style('fill', (d) => d.data.fillColor)
    })
  }

  // Animate chart rings into view
  animateIn () {
    this.chartRing.selectAll('.chart-ring')
      .style('opacity', 0)
      .transition()
      .duration(DURATION)
      .delay((d, i) => {
        return i * 100
      })
      .style('opacity', 1)
  }

  // Colours ring segment based on focus state
  focusEvent (monthIndex, dayIndex, isFocused) {
    const { calendar } = this.props.calendarStore
    dayIndex += calendar[monthIndex].startIndex
    this.focusSegment(monthIndex, dayIndex, isFocused)
  }

  focusSegment (monthIndex, dayIndex, isFocused) {
    // Update row focus
    d3.select('g.chart-ring-' + monthIndex)
      .selectAll('path')
      .transition()
      .duration(150)
      .style('fill', (d, i) => {
        var fillColor = d.data.fillColor

        if (isFocused) {
          if (d.data.date && d.data.type !== 'today') {
            fillColor = utilities.shadeColor(d.data.fillColor, -0.5)
          }
        }

        return fillColor
      })

    // Update segment color
    d3.select('g.chart-ring-' + monthIndex)
      .select('.segment-' + dayIndex)
      .transition()
      .duration(150)
      .style('fill', (d, i) => {
        let fillColor = d.data.fillColor
        if (isFocused) {
          const focusType = d.data.type + 'Focused'
          if (focusType in theme) {
            fillColor = theme[focusType].fillColor
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
        let textColor = d.data.textColor
        if (isFocused) {
          const focusType = d.data.type + 'Focused'
          if (focusType in theme) {
            textColor = theme[focusType].textColor
          }
        }
        return textColor
      })
  }
}

export default Chart
