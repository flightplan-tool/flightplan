import { observable, action } from 'mobx'
import moment from 'moment'
import URLSearchParams from 'url-search-params'

export default class SearchStore {
  @observable loading = false
  @observable awards = []

  @action search (query) {
    const {
      fromCity,
      toCity,
      startDate,
      endDate
    } = query

    // Validate query first
    if (
      !fromCity || fromCity.length !== 3 ||
      !toCity || toCity.length !== 3 ||
      !moment(startDate).isValid() ||
      !moment(endDate).isValid()
    ) {
      return
    }
    query.fromCity = fromCity.toUpperCase()
    query.toCity = toCity.toUpperCase()

    // Build query string
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      params.append(key, value)
    }

    this.loading = true
    const url = 'http://localhost:8000/search?' + params.toString()
    console.log(url)
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error('Search query failed:', url)
        }
        return response.json()
      })
      .then(json => this.setResults(json))
      .catch(err => console.error(err))
  }

  @action setResults (json) {
    console.log("Got results:", json)
    this.loading = false
    this.awards.clear()
    this.awards.replace(json)
  }
}