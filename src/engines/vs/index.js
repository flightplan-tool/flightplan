const { cabins, profiles } = require('../../consts')

module.exports = {
  searcher: require('./searcher'),
  parser: require('./parser'),
  config: {
    name: 'Flying Club',
    homeURL: 'https://www.virginatlantic.com/us/en',
    searchURL: 'https://www.virginatlantic.com/air-shopping/searchFlights.action',
    validation: {
      minDays: 0,
      maxDays: 330
    },
    modifiable: ['departDate', 'returnDate'],
    throttling: profiles.slow,
    fares: [
      {code: 'F', cabin: cabins.first, saver: true, name: 'First'},
      {code: 'J', cabin: cabins.business, saver: true, name: 'Upper Class'},
      {code: 'W', cabin: cabins.premium, saver: true, name: 'Premium Economy'},
      {code: 'Y', cabin: cabins.economy, saver: true, name: 'Economy'}
    ]
  }
}
