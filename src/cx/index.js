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
    throttling: profiles.slow,
    fares: [
      {code: 'FS', cabin: cabins.first, saver: true, name: 'First Standard'},
      {code: 'F1', cabin: cabins.first, saver: false, name: 'First Priority 1'},
      {code: 'F2', cabin: cabins.first, saver: false, name: 'First Priority 2'},
      {code: 'CS', cabin: cabins.business, saver: true, name: 'Business Standard'},
      {code: 'C1', cabin: cabins.business, saver: false, name: 'Business Priority 1'},
      {code: 'C2', cabin: cabins.business, saver: false, name: 'Business Priority 2'},
      {code: 'WS', cabin: cabins.premium, saver: true, name: 'Prem. Econ. Standard'},
      {code: 'W1', cabin: cabins.premium, saver: false, name: 'Prem. Econ. Priority 1'},
      {code: 'W2', cabin: cabins.premium, saver: false, name: 'Prem. Econ. Priority 2'},
      {code: 'YS', cabin: cabins.economy, saver: true, name: 'Economy Standard'},
      {code: 'Y1', cabin: cabins.economy, saver: false, name: 'Economy Priority 1'},
      {code: 'Y2', cabin: cabins.economy, saver: false, name: 'Economy Priority 2'}
    ]
  }
}
