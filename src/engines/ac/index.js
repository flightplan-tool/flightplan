const { cabins, profiles } = require('../../consts')

module.exports = {
  searcher: require('./searcher'),
  parser: require('./parser'),
  config: {
    name: 'Aeroplan',
    homeURL: 'https://www.aeroplan.com/landing/process.do?lang=E',
    searchURL: 'https://www.aeroplan.com/en/use-your-miles/travel.html',
    validation: {
      minDays: 0,
      maxDays: 356
    },
    throttling: profiles.fast,
    fares: [
      {code: 'OS', cabin: cabins.first, saver: true, name: 'First Fixed Mileage'},
      {code: 'OP', cabin: cabins.first, saver: false, name: 'First Market Fare'},
      {code: 'IS', cabin: cabins.business, saver: true, name: 'Business Fixed Mileage'},
      {code: 'IP', cabin: cabins.business, saver: false, name: 'Business Market Fare'},
      {code: 'NS', cabin: cabins.premium, saver: true, name: 'Prem. Econ. Fixed Mileage'},
      {code: 'NP', cabin: cabins.premium, saver: false, name: 'Prem. Econ. Market Fare'},
      {code: 'XS', cabin: cabins.economy, saver: true, name: 'Economy Fixed Mileage'},
      {code: 'XP', cabin: cabins.economy, saver: false, name: 'Economy Market Fare'}
    ]
  }
}
