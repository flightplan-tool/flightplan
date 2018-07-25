const { cabins, profiles } = require('../consts')

module.exports = {
  engine: require('./engine'),
  config: {
    name: 'British Airways',
    website: 'Executive Club',
    searchURL: 'https://www.britishairways.com/travel/redeem/execclub/_gf/en_us?eId=106019&tab_selected=redeem&redemption_type=STD_RED',
    waitUntil: 'networkidle0',
    roundtripOptimized: true,
    tripMinDays: 3,
    validation: {
      minDays: 0,
      maxDays: 354
    },
    modifiable: ['departDate', 'returnDate'],
    throttling: profiles.fast,
    fares: [
      {code: 'F', cabin: cabins.first, saver: true, name: 'First'},
      {code: 'C', cabin: cabins.business, saver: true, name: 'Business / Club'},
      {code: 'W', cabin: cabins.premium, saver: true, name: 'Premium Economy'},
      {code: 'M', cabin: cabins.economy, saver: true, name: 'Economy'}
    ]
  }
}
