import { computed } from 'mobx'
import moment from 'moment'

const DISPLAY_SEGMENTS = 39 // Total segments to display on screen
const TOTAL_SEGMENTS = 48 // Total number of segments for each chart ring

export default class CalendarStore {
  constructor (searchStore) {
    this.searchStore = searchStore
    this.today = moment().startOf('day')
    this.calendar = this.createCalendar(this.today)
  }

  createCalendar (today) {
    const start = today.clone().startOf('month')
    const end = today.clone().add(1, 'year').endOf('month')

    // Create calendar for next 365 days
    let counter = 0
    const calendar = []
    const index = start.clone()
    while (index.isBefore(end, 'day')) {
      calendar.push({
        index: counter++,
        days: index.daysInMonth(),
        month: index.month(),
        year: index.year(),
        startIndex: index.day(),
        monthLabel: index.format('MMMM YYYY')
      })
      index.add(1, 'month')
    }

    return calendar
  }

  @computed get data () {
    const { searchStore } = this

    // Map months to segments
    const data = this.calendar.map(month => this.createSegments(month))

    // Annotate with current day, search range, and search results
    this.markResults(data, searchStore.awards)

    return data
  }

  createSegments (month) {
    const { today } = this

    const segments = []
    const { startIndex } = month

    for (var i = 0; i <= TOTAL_SEGMENTS; i++) {
      let date = null
      let type = 'none'
      let isWeekend = false
      
      if (i < startIndex) {
        type = 'void'
      } else if (i < (month.days + startIndex)) {
        // This is a calendar day, compute date
        date = moment({
          year: month.year,
          month: month.month,
          day: (i - startIndex) + 1
        })
        
        // Now figure out what type it is
        const day = date.day()
        isWeekend = (day === 6) || (day === 0)
        if (date.isSame(today, 'day')) {
          type = 'today'
        } else {
          type = 'inactive'
        }
      } else if (i <= DISPLAY_SEGMENTS) {
        type = 'void'
      }

      segments.push({
        count: (100 / 40),
        index: month.index,
        text: this.getDaySlug(date),
        type,
        date,
        isWeekend,
      })
    }

    return segments
  }

  getDaySlug (itemDate) {
    return itemDate ? itemDate.format('DD') : ''
  }

  markResults (data, awards) {
    // Assign each award to the segment it belongs to
    for (const award of awards) {
      const segment = this.findSegment(data, moment(award.date))
      if (segment) {
        if (!segment.awards) {
          segment.awards = []
        }
        if (award.fares.length > 0) {
          segment.awards.push(award)
        }
        segment.type = 'active'
      }
    }
  }

  findSegment(data, date) {
    const { calendar } = this

    // Find matching month first
    const monthIdx = calendar.findIndex(x => (
      x.year === date.year() && x.month === date.month()
    ))
    if (monthIdx >= 0) {
      // Locate matching day
      const dayIdx = calendar[monthIdx].startIndex + date.date() - 1
      if (dayIdx >= 0 && dayIdx < data[monthIdx].length) {
        return data[monthIdx][dayIdx]
      }
    }
    return null
  }
}
