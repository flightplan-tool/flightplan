const Config = require('../Config')

// Register all supported engines
const engines = {
  ac: require('./ac'),
  as: require('./as'),
  ba: require('./ba'),
  cx: require('./cx'),
  ke: require('./ke'),
  nh: require('./nh'),
  sq: require('./sq')
}

// Validate all engine configs
Object.values(engines).forEach(x => { x.config = new Config(x.config) })

// Expose registered engines to Award and Results
require('../Award')._engines = engines
require('../Results')._engines = engines

module.exports = engines
