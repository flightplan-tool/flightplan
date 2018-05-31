import CalendarStore from './calendarStore'
import SearchStore from './searchStore'

const searchStore = new SearchStore()
const calendarStore = new CalendarStore(searchStore)

export default {
  searchStore,
  calendarStore
}
