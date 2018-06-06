import { observable, computed, action } from 'mobx'

// const AIRLINE_NAMES = {
//   SQ: 'Singapore Airlines'
// }

// const CABIN_ORDER = ['FS', 'FA', 'CS', 'CA', 'WS', 'WA', 'YS', 'YA']

// const FARE_CODE_NAMES = {
//   FS: 'First Saver',
//   FA: 'First Advantage',
//   CS: 'Business Saver',
//   CA: 'Business Advantage',
//   WS: 'Prem. Econ. Saver',
//   WA: 'Prem. Econ. Advantage',
//   YS: 'Economy Saver',
//   YA: 'Economy Advantage'
// }

// export {
//   AIRLINE_NAMES,
//   FARE_CODE_NAMES,
//   CABIN_ORDER
// }

export default class ConfigStore {
  @observable config
  @observable error
  @observable loading = true

  constructor () {
    this.load()
  }

  @computed get airlines () {
    return this.loading ? null : this.config.airlines
  }

  @computed get cabins () {
    return this.loading ? null : this.config.cabins
  }

  @action async load () {
    try {
      // Fetch config from server
      const response = await fetch('/api/config')
      
      // Check status code
      if (!response.ok) {
        throw new Error(`Invalid server response: ${response.status} - ${response.statusText}`)
      }

      // Set config
      this.config = await response.json()
      this.loading = false
    } catch (err) {
      this.loading = false
      this.error = err
      console.error(err)
    }
  }
}