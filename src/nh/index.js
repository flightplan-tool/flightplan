const { cabins } = require('../consts')

module.exports = {
  engine: require('./engine'),
  config: {
    name: 'All Nippon Airways',
    website: 'ANA Mileage Club',
    searchURL: 'https://aswbe-i.ana.co.jp/international_asw/pages/award/search/roundtrip/award_search_roundtrip_input.xhtml?CONNECTION_KIND=JPN&LANG=en',
    waitUntil: 'networkidle0',
    tripMinDays: 3,
    validation: {
      minDays: 3,
      maxDays: 355
    },
    throttling: {
      requestsPerHour: 80,
      period: 30 * 60
    },
    fares: {
      FS: {cabin: cabins.first, saver: true},
      CS: {cabin: cabins.business, saver: true},
      YS: {cabin: cabins.economy, saver: true}
    }
  }
}
