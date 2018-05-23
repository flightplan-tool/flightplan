const { cabins } = require('../consts')

module.exports = {
  engine: require('./engine'),
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
    fares: {
      A: {cabin: cabins.first, saver: true},
      CS: {cabin: cabins.business, saver: true},
      YS: {cabin: cabins.economy, saver: true}
    }
  }
}
