const { cabins } = require('../consts')

module.exports = {
  engine: require('./engine'),
  parser: require('./parser'),
  config: {
    name: 'Singapore Airlines',
    website: 'KrisFlyer',
    searchURL: 'https://www.singaporeair.com/en_UK/ppsclub-krisflyer/flightsearch/',
    waitUntil: 'networkidle2',
    tripMinDays: 3,
    validation: {
      minDays: 0,
      maxDays: 354
    },
    throttling: {
      requestsPerHour: 60,
      period: 15 * 60
    },
    fares: [
      {code: 'FS', cabin: cabins.first, saver: true, name: 'First Saver'},
      {code: 'FA', cabin: cabins.first, saver: false, name: 'First Advantage'},
      {code: 'CS', cabin: cabins.business, saver: true, name: 'Business Saver'},
      {code: 'CA', cabin: cabins.business, saver: false, name: 'Business Advantage'},
      {code: 'WS', cabin: cabins.premium, saver: true, name: 'Prem. Econ. Saver'},
      {code: 'WA', cabin: cabins.premium, saver: false, name: 'Prem. Econ. Advantage'},
      {code: 'YS', cabin: cabins.economy, saver: true, name: 'Economy Saver'},
      {code: 'YA', cabin: cabins.economy, saver: false, name: 'Economy Advantage'}
    ]
  }
}