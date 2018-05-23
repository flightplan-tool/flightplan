const { cabins } = require('../consts')

module.exports = {
  engine: require('./engine'),
  config: {
    name: 'Cathay Pacific',
    website: 'AsiaMiles',
    searchURL: 'https://api.asiamiles.com/ibered/jsp/redeem-flights/asia-miles-flight-award-redemption.jsp?ENTRYCOUNTRY=HK&ENTRYLANGUAGE=en&ENTRYPOINT=asiamiles.com',
    waitUntil: 'networkidle0',
    tripMinDays: 3,
    validation: {
      minDays: 1,
      maxDays: 355
    },
    throttling: {
      requestsPerHour: 30,
      period: 15 * 60
    },
    fares: {
      FS: {cabin: cabins.first, saver: true},
      F1: {cabin: cabins.first, saver: false},
      F2: {cabin: cabins.first, saver: false},
      CS: {cabin: cabins.business, saver: true},
      C1: {cabin: cabins.business, saver: false},
      C2: {cabin: cabins.business, saver: false},
      WS: {cabin: cabins.premium, saver: true},
      W1: {cabin: cabins.premium, saver: false},
      W2: {cabin: cabins.premium, saver: false},
      YS: {cabin: cabins.economy, saver: true},
      Y1: {cabin: cabins.economy, saver: false},
      Y2: {cabin: cabins.economy, saver: false}
    }
  }
}
