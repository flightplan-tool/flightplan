const { cabins, profiles } = require('../consts')

module.exports = {
  engine: require('./engine'),
  parser: require('./parser'),
  config: {
    name: 'Korean Air',
    website: 'SKYPASS',
    mainURL: 'https://www.koreanair.com/global/en.html',
    searchURL: 'https://www.koreanair.com/global/en/booking/booking-gate.html?awa#domestic-award',
    waitUntil: 'networkidle0',
    oneWaySupported: false,
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
