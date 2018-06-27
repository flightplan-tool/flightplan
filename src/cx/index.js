const { cabins, profiles } = require('../consts')

module.exports = {
  engine: require('./engine'),
  config: {
    name: 'Cathay Pacific',
    website: 'AsiaMiles',
    searchURL: 'https://www.asiamiles.com/en/redeem-awards/flight-awards/facade.html?recent_search=true',
    waitUntil: 'networkidle0',
    roundtripOptimized: false,
    tripMinDays: 3,
    validation: {
      minDays: 1,
      maxDays: 355
    },
    throttling: profiles.fast,
    fares: [
      {code: 'FS', cabin: cabins.first, saver: true, name: 'First Standard'},
      {code: 'F1', cabin: cabins.first, saver: false, name: 'First Choice'},
      {code: 'CS', cabin: cabins.business, saver: true, name: 'Business Standard'},
      {code: 'C1', cabin: cabins.business, saver: false, name: 'Business Choice'},
      {code: 'WS', cabin: cabins.premium, saver: true, name: 'Prem. Econ. Standard'},
      {code: 'W1', cabin: cabins.premium, saver: false, name: 'Prem. Econ. Choice'},
      {code: 'YS', cabin: cabins.economy, saver: true, name: 'Economy Standard'},
      {code: 'Y1', cabin: cabins.economy, saver: false, name: 'Economy Choice'}
    ]
  }
}
