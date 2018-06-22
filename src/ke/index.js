const { cabins } = require('../consts')

module.exports = {
  engine: require('./engine'),
  parser: require('./parser'),
  config: {
    name: 'Korean Air',
    website: 'SKYPASS',
    searchURL: 'https://www.koreanair.com/global/en/booking/booking-gate.html#bookingChange',
    waitUntil: 'networkidle0',
    tripMinDays: 3,
    validation: {
      minDays: 1,
      maxDays: 355
    },
    throttling: {
      requestsPerHour: 80,
      period: 30 * 60
    },
    fares: [
      {code: 'A', cabin: cabins.first, saver: true, name: 'First'},
      {code: 'O', cabin: cabins.business, saver: true, name: 'Prestige'},
      {code: 'X', cabin: cabins.economy, saver: true, name: 'Economy'}
    ]
  }
}
