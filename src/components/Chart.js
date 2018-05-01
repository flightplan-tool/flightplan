import React, { Component } from 'react'
import { inject } from 'mobx-react'
import * as d3 from 'd3'

import * as utilities from '../lib/utilities'
import * as constants from '../lib/constants'

import './Chart.css'

// CONSTANTS
const DAYS_OF_WEEK = 7
const DISPLAY_SEGMENTS = 39 // Total segments to display on screen
const TOTAL_SEGMENTS = 48 // Total number of segments for each chart ring
const DURATION = 1000
const DELAY = 1000
const OFFSET = 22

@inject('chartStore')
class Chart extends Component {
  constructor (props) {
    super(props)

    this.dataset = []
    this.store = props.chartStore
  }

  componentDidMount () {
    this.renderChart()
  }

  componentDidUpdate () {
    this.renderChart()
  }

  render () {
    return <div className='chart' ref={(x) => { this._ref = x }} />
  }

  /// ////////////////////////////////////////////////////////
  // CHART CREATION
  /// ////////////////////////////////////////////////////////

  renderChart () {
    const { config } = this.props

    const baseUnit = (window.innerHeight > 1000) ? ((window.innerHeight - 100) - 20) : 1000
    this.width = baseUnit - OFFSET
    this.height = baseUnit - OFFSET
    this.innerRadius = ((baseUnit / 2) - 20)
    this.outerRadius = (baseUnit / 2)

    // Make dataset available to service
    this.store.setCalendarConfig(config.calendar)
    this.store.setChartConfig(this.dataset)
    this.store.setEventsConfig(config.events)
    this.store.setDefaultsConfig(config.defaults)

    // Chart
    this.configureDataset()
    this.create()

    // Animations
    this.animateIn()
  }

  /**
   * Configure calendar dataset
   */
  configureDataset () {
    const { config } = this.props

    config.calendar.forEach((month, index) => {
      this.dataset[index] = [] // Add empty array at current month index
      this.configureSegments(month, index)
    })

    this.addMarkers()
  }

  configureSegments (month, index) {
    const { config } = this.props

    var currentDayIndex = month.startIndex

    for (var i = 0; i <= TOTAL_SEGMENTS; i++) {
      // Local vars
      var fillColor = 'none'
      var textColor = month.textColor
      var segmentLabel = ''
      var isActive = false
      var itemDate = ''
      var dayOfWeek = ''

      if (i < month.startIndex) {
        // Shade offset segments same color as chartRing
        fillColor = config.defaults.COLOR_FOREGROUND
      } else if (i < (month.days + month.startIndex)) {
        isActive = true
        itemDate = this.getSegmentDate(i, month.index, month.startIndex)
        segmentLabel = this.getSegmentLabel(i)
        fillColor = this.getFillColor(currentDayIndex, month.fillColor)

        // Increment current day index
        currentDayIndex = this.getDayOfWeekIndex(currentDayIndex)
        dayOfWeek = constants.DAYS_OF_WEEK[currentDayIndex]
      } else if (i <= DISPLAY_SEGMENTS) {
        fillColor = config.defaults.COLOR_FOREGROUND
      }

      this.dataset[index].push({
        count: (100 / 40),
        isActive: isActive,
        fillColor: fillColor,
        textColor: textColor,
        label: segmentLabel,
        date: new Date(itemDate),
        day: utilities.getDaySlug(((i + 1) - month.startIndex)),
        month: utilities.getMonthSlug((month.index + 1)),
        year: config.year,
        dayOfWeek: dayOfWeek
      })
    }
  }

  addMarkers () {
    this.store.markCurrentDay()
    this.store.markEvents()
  }

  /// ////////////////////////////////////////////////////////
  // CHART CREATION
  /// ////////////////////////////////////////////////////////

  create () {
    let { width, height } = this

    // Calculate new values based on index
    width -= OFFSET
    height -= OFFSET

    this.pie = d3.pie()
      .padAngle(0.005)
      .value((d) => {
        return d.count
      }).sort(null)

    this.chartRing = d3.select(this._ref).append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('margin-top', (OFFSET / 2) + 'px')
      .style('margin-left', (OFFSET / 2) + 'px')
      .attr('class', 'calendar-chart-ring')
      .attr('viewBox', '0 0 ' + width + ' ' + width)
      .append('g')
      .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')')
      .call(() => this.addSegments())
  }

  addSegments () {
    this.dataset.forEach((month, index) => {
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

      // Configure segment colour
      group.selectAll('path')
        .data(this.pie(month))
        .enter()
        .append('path')
        .attr('d', arc)
        .attr('class', (d, i) => {
          return 'segment segment-' + i
        })
        .attr('fill', (d) => {
          return d.data.fillColor
        })
        .on('mouseover', (d) => {
          if (d.data.isActive) {
            var monthIndex = utilities.getMonthIndexFromDate(d.data.date)
            var dayIndex = utilities.getDayIndexFromDate(d.data.date)
            this.store.focusEvent(monthIndex, dayIndex, true)
          }
        })
        .on('mouseout', (d) => {
          if (d.data.isActive) {
            var monthIndex = utilities.getMonthIndexFromDate(d.data.date)
            var dayIndex = utilities.getDayIndexFromDate(d.data.date)
            this.store.focusEvent(monthIndex, dayIndex, false)
          }
        })
        .on('click', (d) => {
          console.log('You clicked:', d.data)
          // if (d.data.isActive) {
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
    const { config } = this.props

    // Configure month labels
    group.selectAll('g.month-label')
      .data([config.calendar[index].index])
      .enter()
      .append('g')
      .attr('class', 'month-label')
      .append('text')
      .style('text-anchor', 'end')
      .attr('dx', '-20')
      .attr('dy', (this.outerRadius * -1) + 13)
      .attr('fill', config.calendar[index].fillColor)
      .text((d, i) => {
        return constants.MONTH_LABELS[d]
      })
  }

  addDayLabels (group, month, arc, index) {
    const { config } = this.props

    // Configure day labels
    group.selectAll('g.segment-label')
      .data(this.pie(month))
      .enter()
      .append('g')
      .attr('class', (d, i) => {
        return 'segment-label ' + this.getSegmentLabel(i)
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
      .style('fill', (d, i) => {
        return d.data.textColor
      })
      .text((d, i) => {
        var text = ''

        if (i < config.calendar[index].startIndex) {
          text = ''
        } else if (i < (config.calendar[index].days + config.calendar[index].startIndex)) {
          text = ((i + 1) - (config.calendar[index].startIndex))

          if (text < 10) {
            text = '0' + text
          }
        }

        return text
      })
  }

  /**
   * Animate chart rings into view
   */
  animateIn () {
    this.chartRing.selectAll('.chart-ring')
      .style('opacity', 0)
      .transition()
      .duration(DURATION)
      .delay((d, i) => {
        return (DELAY + (i * 100))
      })
      .style('opacity', 1)
  }

  /**
   * Animate chart rings into view
   */
  animateOut () {
    this.chartRing.selectAll('.chart-ring')
      .style('opacity', 1)
      .transition()
      .duration(DURATION)
      .delay((d, i) => {
        return (DELAY + (i * 100))
      })
      .style('opacity', 0)
  }

  /// ///////////////////////////////////////////////////////////////////
  // HELPERS
  /// ///////////////////////////////////////////////////////////////////

  getSegmentLabel (index) {
    return 'segment-label-' + index
  }

  getSegmentDate (index, itemIndex, startIndex) {
    return (this.props.config.year + '-' + (itemIndex + 1) + '-' + ((index + 1) - startIndex))
  }

  getDayOfWeekIndex (index) {
    // Days of week iterator
    if (index === (DAYS_OF_WEEK - 1)) {
      index = 0
    } else {
      index++
    }

    return index
  }

  /**
   * Determine if current segments are Saturday or Sunday
   * and shade accordingly
   */
  getFillColor (index, color) {
    var fillColor = color

    if ((index === (DAYS_OF_WEEK - 2)) || (index === (DAYS_OF_WEEK - 1))) {
      fillColor = utilities.shadeColor(color, -0.3)
    }

    return fillColor
  }

  /// ///////////////////////////////////////////////////////////////////
  // GETTERS
  /// ///////////////////////////////////////////////////////////////////

  getMonth (year, month) {
    var monthObj = this.props.config.chart[utilities.getMonthIndex(month)]
    return monthObj.filter(x => x.isActive)
  }

  getDay (year, month, day) {
    const days = this.props.config.chart[utilities.getMonthIndex(month)]
    return days.find(x => (x.day === day))
  }
}

export default Chart
