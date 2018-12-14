const { cabins, profiles } = require('../../consts')

module.exports = {
  searcher: require('./searcher'),
  parser: require('./parser'),
  config: {
    name: 'ANA Mileage Club',
    homeURL: 'https://www.ana.co.jp/en/us/',
    searchURL: 'https://aswbe-i.ana.co.jp/international_asw/pages/award/search/roundtrip/award_search_roundtrip_input.xhtml?CONNECTION_KIND=JPN&LANG=en',
    waitUntil: 'networkidle0',
    validation: {
      minDays: 4,
      maxDays: 355
    },
    throttling: profiles.fast,
    fares: [
      {code: 'FS', cabin: cabins.first, saver: true, name: 'First'},
      {code: 'CS', cabin: cabins.business, saver: true, name: 'Business'},
      {code: 'WS', cabin: cabins.premium, saver: true, name: 'Premium'},
      {code: 'YS', cabin: cabins.economy, saver: true, name: 'Economy'}
    ]
  }
}
