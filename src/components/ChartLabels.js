import React, { Component } from 'react'
import * as d3 from 'd3'

import './ChartLabels.css'

class ChartLabels extends Component {
  componentDidMount () {
    this.renderLabels()
  }

  componentDidUpdate () {
    this.renderLabels()
  }

  render () {
    var style = {
      left: '-50px',
      top: '-50px'
    }

    return (
      <div className='calendar-chart-labels' style={style} ref={(x) => { this._ref = x }}>
        {this.props.children}
      </div>
    )
  }

  renderLabels () {
    // Constants
    const DISPLAY_SEGMENTS = 39 // Total segments to display on screen
    const TOTAL_SEGMENTS = 48
    const BASE_UNIT = (window.innerHeight > 1000) ? ((window.innerHeight - 100) - 20) : 1000

    // Vars
    var dayOfWeekIndex = 0
    var donutData = []
    var width = (BASE_UNIT + 100)
    var height = (BASE_UNIT + 100)
    var innerRadius = ((BASE_UNIT / 2) - 20)
    var outerRadius = (BASE_UNIT / 2)

    var DAYS_OF_WEEK = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday'
    ]

    var svg = d3.select(this._ref).append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')')

    /// ///////////////////////////////////////////////////////////
    /// ////////////////// Data &  Scales /////////////////////////
    /// ///////////////////////////////////////////////////////////

    for (var i = 0; i <= TOTAL_SEGMENTS; i++) {
      // Increment first and start calendar off at Monday
      if (dayOfWeekIndex < (DAYS_OF_WEEK.length - 1)) {
        dayOfWeekIndex++
      } else {
        dayOfWeekIndex = 0
      }

      donutData.push({
        name: (i <= DISPLAY_SEGMENTS) ? DAYS_OF_WEEK[dayOfWeekIndex] : '',
        value: (100 / 40)
      })
    }

    // Create an arc function
    var arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)

    var pie = d3.pie()
      .padAngle(0.005)
      .value(function (d) {
        return d.value
      }).sort(null)

    /// ///////////////////////////////////////////////////////////
    /// ///////////////// Create Donut Chart //////////////////////
    /// ///////////////////////////////////////////////////////////

    // Create the donut slices and also the invisible arcs for the text
    svg.selectAll('.donutArcs')
      .data(pie(donutData))
      .enter().append('path')
      .attr('class', 'donutArcs')
      .attr('d', arc)
      .style('fill', 'none')
      .each(function (d, i) {
        // Search pattern for everything between the start and the first capital L
        var firstArcSection = /(^.+?)L/

        // Grab everything up to the first Line statement
        var newArc = firstArcSection.exec(d3.select(this).attr('d'))[1]
        // Replace all the comma's so that IE can handle it
        newArc = newArc.replace(/,/g, ' ')

        // Create a new invisible arc that the text can flow along
        svg.append('path')
          .attr('class', 'hiddenDonutArcs')
          .attr('id', 'donutArc' + i)
          .attr('d', newArc)
          .style('fill', 'none')
      })

    // Append the label names on the outside
    svg.selectAll('.day-of-month-label')
      .data(pie(donutData))
      .enter().append('text')
      .attr('class', 'day-of-month-label')
      .append('textPath')
      .attr('startOffset', '50%')
      .style('text-anchor', 'middle')
      .style('fill', function (d, i) {
        var color = '#bbb'

        if (d.data.name === DAYS_OF_WEEK[0] || d.data.name === DAYS_OF_WEEK[6]) {
          return '#999'
        }

        return color
      })
      .style('opacity', 0)
      .attr('xlink:href', function (d, i) {
        return '#donutArc' + i
      })
      .text(function (d) {
        return d.data.name
      })
      .transition()
      .duration(1500)
      .delay(1500)
      .style('opacity', 1)
  }
}

export default ChartLabels
