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
    fares: {
      FS: {cabin: cabins.first, saver: true},
      FA: {cabin: cabins.first, saver: false},
      CS: {cabin: cabins.business, saver: true},
      CA: {cabin: cabins.business, saver: false},
      WS: {cabin: cabins.premium, saver: true},
      WA: {cabin: cabins.premium, saver: false},
      YS: {cabin: cabins.economy, saver: true},
      YA: {cabin: cabins.economy, saver: false}
    }
  }
}
