const { cabins, profiles } = require('../../consts')

module.exports = {
  searcher: require('./searcher'),
  parser: require('./parser'),
  config: {
    name: 'AsiaMiles',
    homeURL: 'https://www.asiamiles.com',
    searchURL: 'https://www.asiamiles.com/en/redeem-awards/flight-awards/facade.html?recent_search=true',
    waitUntil: 'networkidle0',
    validation: {
      minDays: 1,
      maxDays: 355
    },
    throttling: profiles.fast,
    fares: [
      {code: 'FS', cabin: cabins.first, saver: true, name: 'First Standard'},
      {code: 'F1', cabin: cabins.first, saver: false, name: 'First Choice'},
      {code: 'F2', cabin: cabins.first, saver: false, name: 'First Tailored'},
      {code: 'CS', cabin: cabins.business, saver: true, name: 'Business Standard'},
      {code: 'C1', cabin: cabins.business, saver: false, name: 'Business Choice'},
      {code: 'C2', cabin: cabins.business, saver: false, name: 'Business Tailored'},
      {code: 'WS', cabin: cabins.premium, saver: true, name: 'Prem. Econ. Standard'},
      {code: 'W1', cabin: cabins.premium, saver: false, name: 'Prem. Econ. Choice'},
      {code: 'W2', cabin: cabins.premium, saver: false, name: 'Prem. Econ. Tailored'},
      {code: 'YS', cabin: cabins.economy, saver: true, name: 'Economy Standard'},
      {code: 'Y1', cabin: cabins.economy, saver: false, name: 'Economy Choice'},
      {code: 'Y2', cabin: cabins.economy, saver: false, name: 'Economy Tailored'}
    ]
  }
}
