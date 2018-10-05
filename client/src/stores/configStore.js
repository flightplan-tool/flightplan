import { observable, computed, action } from 'mobx'

export default class ConfigStore {
  @observable config
  @observable error
  @observable loading = true

  constructor () {
    this.load()
  }

  @computed get engines () {
    return this.loading ? null : this.config.engines
  }

  @computed get aircraft () {
    return this.loading ? null : this.config.aircraft
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