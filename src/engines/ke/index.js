const { cabins, profiles } = require('../../consts')

module.exports = {
  searcher: require('./searcher'),
  parser: require('./parser'),
  config: {
    name: 'SKYPASS',
    homeURL: 'https://www.koreanair.com/global/en.html',
    searchURL: 'https://www.koreanair.com/global/en/booking/booking-gate.html?awa#domestic-award',
    waitUntil: 'networkidle0',
    validation: {
      minDays: 1,
      maxDays: 355
    },
    modifiable: ['departDate', 'returnDate'],
    throttling: profiles.fast,
    fares: [
      {code: 'A', cabin: cabins.first, saver: true, name: 'First'},
      {code: 'O', cabin: cabins.business, saver: true, name: 'Prestige'},
      {code: 'X', cabin: cabins.economy, saver: true, name: 'Economy'}
    ]
  }
}
