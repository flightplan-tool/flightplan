import React, { Component } from 'react'
import * as d3 from 'd3'
import moment from 'moment'

import './ChartLabels.css'

class ChartLabels extends Component {
  componentDidMount () {
    this.renderLabels()
  }

  componentDidUpdate () {
    this.renderLabels()
  }

  shouldComponentUpdate () {
    return false
  }

  render () {
    return (
      <div className='calendar-chart-labels' ref={(x) => { this._ref = x }} />
    )
  }

  renderLabels () {
    // Constants
    const DISPLAY_SEGMENTS = 39 // Total segments to display on screen
    const TOTAL_SEGMENTS = 48

    // Vars
    const baseUnit = 1000
    var donutData = []
    var size = baseUnit + 20
    var innerRadius = ((baseUnit / 2) - 20)
    var outerRadius = (baseUnit / 2)

    var svg = d3.select(this._ref).append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .style('margin-top', (22 / 2) + 'px')
      .style('margin-left', (22 / 2) + 'px')
      .attr('viewBox', '0 0 ' + size + ' ' + size)
      .append('g')
      .attr('transform', 'translate(' + size / 2 + ',' + size / 2 + ')')

    // Create day of week labels, around outer edge of chart
    const index = moment().startOf('week')
    for (var i = 0; i <= TOTAL_SEGMENTS; i++) {
      donutData.push({
        isWeekend: (index.day() === 6) || (index.day() === 0),
        name: (i <= DISPLAY_SEGMENTS) ? index.format('dddd') : '',
        value: (100 / 40)
      })
      index.add(1, 'day')
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
      .style('fill', (d, i) => d.data.isWeekend ? '#ae5a5a' : '#bbb')
      .style('opacity', 0)
      .attr('xlink:href', (d, i) => '#donutArc' + i)
      .text((d) => d.data.name)
      .transition()
      .duration(1000)
      .delay(1000)
      .style('opacity', 1)
  }
}

export default ChartLabels
