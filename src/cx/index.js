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
