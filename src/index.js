const consts = require('./consts')
const Engine = require('./base')

const engines = {
  cx: require('./cx'),
  ke: require('./ke'),
  nh: require('./nh'),
  sq: require('./sq')
}

module.exports = {
  new: (airline, options = {}) => {
    const engine = engines[airline.toLowerCase()]
    if (!engine) {
      throw new Error(`No supported engine found for airline: ${airline}`)
    }

    // Wrap it in a class that implements the common functionality
    return new Engine(airline.toUpperCase(), engine, options)
  },

  supported: (airline) => {
    const set = Object.keys(engines).sort().map(x => x.toUpperCase())
    return airline ? set.includes(airline) : set
  },

  ...consts
}
