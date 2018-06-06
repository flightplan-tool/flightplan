import CalendarStore from './calendarStore'
import ConfigStore from './configStore'
import SearchStore from './searchStore'

const configStore = new ConfigStore()
const searchStore = new SearchStore(configStore)
const calendarStore = new CalendarStore(searchStore)

export default {
  configStore,
  searchStore,
  calendarStore
}
