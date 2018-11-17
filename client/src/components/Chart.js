import React, { Component } from 'react'
import Modal from 'react-responsive-modal'
import { autorun } from 'mobx'
import { inject } from 'mobx-react'
import * as d3 from 'd3'
import d3Tip from "d3-tip"

import * as utilities from '../lib/utilities'
import Awards from './Awards'

import './Chart.css'

// Theme
import theme from './theme.json'

// Constants
const DURATION = 1000
const OFFSET = 22

@inject('calendarStore', 'configStore', 'searchStore')
class Chart extends Component {
  state = {
    showAwards: null
  }

  componentDidMount () {
    const { data } = this.props.calendarStore
    this.applyTheme(data)
    this.createChart(data)
    this.animateIn()

    // Create an autorun, that automatically updates segment colors
    // based on underlying mobx data store
    autorun(() => {
      const { data } = this.props.calendarStore
      this.applyTheme(data)
      this.updateChart(data)
    })
  }

  shouldComponentUpdate (nextProps, nextState) {
    if (nextState.showAwards !== this.state.showAwards) {
      return true
    }
    return false
  }

  render () {
    const { showAwards } = this.state

    return (
      <div className='chart' ref={(x) => { this._ref = x }}>
        <Modal
          open={!!showAwards}
          onClose={() => this.setState({ showAwards: null })}
          classNames={{ modal: 'modal' }}
        >
          <Awards data={showAwards} />
        </Modal>
      </div>
    )
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
        const { awards, type, isWeekend } = segment
        if (!awards && isWeekend && (type === 'inactive' || type === 'active')) {
          segment.fillColor = utilities.shadeColor(segment.fillColor, -0.3)
        }
      }
    }
  }

  segmentStyle (segment) {
    if (segment.awards) {
      const { legend } = this.props.searchStore

      // For fill color, grab awards from the first airline alphabetically
      const engine = segment.awards.map(x => x.engine).sort()[0]

      // Merge all award codes for this engine
      const awards = segment.awards.filter(x => x.engine === engine)
      const codes = awards.reduce((set, award) => {
        award.fares.split(' ').forEach(x => set.add(x))
        return set
      }, new Set())

      // Lookup the color from the legend data
      const section = legend.find(x => x.key === engine)
      if (section) {
        const match = section.fares.find(x => codes.has(x.key))
        if (match) {
          const { index, waitlisted } = match
          const palette = waitlisted ? theme.awardWaitlisted : theme.award
          return palette[index % palette.length]
        }
      }
    }
    if (segment.type in theme) {
      return theme[segment.type]
    }
    return {fillColor: 'none'}
  }

  createChart (data) {
    const baseUnit = 1000
    const size = baseUnit + OFFSET
    this.innerRadius = ((baseUnit / 2) - 20)
    this.outerRadius = (baseUnit / 2)

    this.pie = d3.pie()
      .padAngle(0.005)
      .value((d) => {
        return d.count
      }).sort(null)

    this.tip = d3Tip()
      .attr('class', 'tooltip')
      .direction('sw')
      .html((d) => this.renderToolTip(d.data))

    this.chartRing = d3.select(this._ref).append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .style('margin-top', (OFFSET / 2) + 'px')
      .style('margin-left', (OFFSET / 2) + 'px')
      .attr('class', 'calendar-chart-ring')
      .attr('viewBox', '0 0 ' + size + ' ' + size)
      .append('g')
      .attr('transform', 'translate(' + size / 2 + ',' + size / 2 + ')')
      .call(this.tip)
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
        .on('mouseover.highlight', (d) => {
          if (d.data.date) {
            var monthIndex = d.data.index
            var dayIndex = d.data.date.date() - 1
            this.focusEvent(monthIndex, dayIndex, true)
          }
        })
        .on('mouseout.highlight', (d) => {
          if (d.data.date) {
            var monthIndex = d.data.index
            var dayIndex = d.data.date.date() - 1
            this.focusEvent(monthIndex, dayIndex, false)
          }
        })
        .on('click', (d) => {
          if (d.data.type === 'active') {
            this.setState({ showAwards: d.data })
          }
        })
      group.selectAll('.segment-label text')
        .attr('fill', (d) => d.data.textColor)
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

  updateChart (data) {
    // Update the chart segment colors based on dataset
    data.forEach((month, index) => {
      const group = d3.select(this._ref)
        .select('g.chart-ring-' + index)

      group.selectAll('path')
        .data(this.pie(month))
        .attr('class', (d, i) => {
          return 'segment segment-' + i + (d.data.awards ? ' awards' : ' empty')
        })
        .transition()
        .duration(DURATION / 2)
        .delay(index * 50)
        .style('fill', (d) => d.data.fillColor)
      group.selectAll('.segment-label text')
        .data(this.pie(month))
        .transition()
        .duration(DURATION / 2)
        .delay(index * 50)
        .style('fill', (d) => d.data.textColor)
    })

    // Update tooltips on segments with award availability
    d3.select(this._ref)
      .selectAll('g.chart-ring')
      .selectAll('path.awards')
      .on('mouseover.tip', this.tip.show)
      .on('mouseout.tip', this.tip.hide)
      .style('cursor', 'pointer')
    d3.select(this._ref)
      .selectAll('g.chart-ring')
      .selectAll('path.empty')
      .on('mouseover.tip', null)
      .on('mouseout.tip', null)
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
    // Update row fill color
    d3.select('g.chart-ring-' + monthIndex)
      .selectAll('path')
      .transition()
      .duration(150)
      .style('fill', (d, i) => this.focusColor(d.data, 'fillColor', isFocused))

    // Update row text color
    d3.select('g.chart-ring-' + monthIndex)
      .selectAll('.segment-label text')
      .transition()
      .duration(150)
      .style('fill', (d, i) => this.focusColor(d.data, 'textColor', isFocused))

    // Update segment fill color
    d3.select('g.chart-ring-' + monthIndex)
      .select('.segment-' + dayIndex)
      .transition()
      .duration(150)
      .style('fill', (d, i) => (isFocused ? theme.highlight.fillColor : d.data.fillColor))

    // Update segment text color
    d3.select('g.chart-ring-' + monthIndex)
      .select('.segment-label-' + dayIndex + ' text')
      .transition()
      .duration(150)
      .style('fill', (d, i) => (isFocused ? theme.highlight.textColor : d.data.textColor))
  }

  focusColor (data, colorType, isFocused) {
    const { awards, type } = data
    let color = data[colorType]
    
    if (isFocused) {
      if (awards) {
        // Tint the color provided (fill color only, not text color)
        if (colorType === 'fillColor') {
          color = utilities.shadeColor(color, -0.15)
        }
      } else {
        // Lookup color from theme
        const focusType = type + 'Focused'
        if (focusType in theme) {
          color = theme[focusType][colorType]
        }
      }
    }

    return color
  }

  renderToolTip (data) {
    const { legend } = this.props.searchStore
    const { date, awards } = data

    const renderRow = (awards) => {
      const { engine } = awards[0]
      
      // Calculate highest quantity available for each fare code
      const fareMap = new Map()
      for (const award of awards) {
        for (const fare of award.fares.split(' ')) {
          fareMap.set(fare, Math.max(award.quantity, fareMap.get(fare) || 0))
        }
      }
      const fares = [...fareMap.entries()].map(entry => {
        const [fareCode, quantity] = entry
        const fare = {
          text: `${quantity}x ${fareCode}`,
          color: '#ccc'
        }

        // Lookup the color from the legend data
        const section = legend.find(x => x.key === engine)
        if (section) {
          const match = section.fares.find(x => x.key === fareCode)
          if (match) {
            const { index, waitlisted } = match
            const palette = waitlisted ? theme.awardWaitlisted : theme.award
            fare.color = palette[index % palette.length].fillColor
          }
        }

        return fare
      })

      const { engineInfo } = this.props.searchStore
      const { name } = engineInfo.get(engine)

      return `
        <div class="logo">
          <img srcset="/images/airlines/${engine.toLowerCase()}_small.png,
                       /images/airlines/${engine.toLowerCase()}_small@2x.png 2x"
               src="/images/airlines/${engine.toLowerCase()}_small.png"
               alt="Airline Logo">
        </div>
        <div>
          <p class="flight"><b>${name}:</b></p>
          <p class="aircraft"></p>
        </div>
        <div class="awards">
          ${fares.map(fare => `<div style="background-color:${fare.color}">${fare.text}</div>`).join('')}
        </div>
      `
    }

    // Convert awards to rows (grouped by engine)
    const engines = awards.reduce((map, x) => {
      const arr = map.get(x.engine) || []
      arr.push(x)
      map.set(x.engine, arr)
      return map
    }, new Map())

    // Generate HTML markup
    return `
      <div class="date">
        <h2>${date.format('ll')}</h2>
      </div>
      ${engines.size === 0 ? '<div class="no-results"><p>Sorry, no awards found!</p></div>' : ''}
      ${[...engines.entries()].map(row => renderRow(row[1])).join('')}
    `
  }
}

export default Chart
