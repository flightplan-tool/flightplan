const { cabins, profiles } = require('../consts')

module.exports = {
  engine: require('./engine'),
  parser: require('./parser'),
  config: (options) => ({
    name: 'Korean Air',
    website: 'SKYPASS',
    searchURL: 'https://www.koreanair.com/global/en/booking/booking-gate.html?awa#domestic-award',
    waitUntil: 'networkidle0',
    nonPartnerSearchSupported: true,
    oneWaySupported: !options.partners,
    roundtripOptimized: options.partners,
    tripMinDays: 3,
    validation: {
      minDays: 1,
      maxDays: 355
    },
    modifiable: ['fromCity', 'toCity', 'departDate', 'returnDate'],
    throttling: profiles.fast,
    fares: [
      {code: 'A', cabin: cabins.first, saver: true, name: 'First'},
      {code: 'O', cabin: cabins.business, saver: true, name: 'Prestige'},
      {code: 'X', cabin: cabins.economy, saver: true, name: 'Economy'}
    ]
  })
}
