const Award = require('./Award')
const BookingClass = require('./BookingClass')
const Config = require('./Config')
const Engine = require('./Engine')
const Flight = require('./Flight')
const Parser = require('./Parser')
const Query = require('./Query')
const Results = require('./Results')
const Searcher = require('./Searcher')
const Segment = require('./Segment')

// Import constants
const { cabins, cabinCodes } = require('./consts')

// Import engines
const engines = require('./engines')

// Export Flightplan API
module.exports = {
  new: (airline) => {
    const engine = engines[airline.toLowerCase()]
    if (!engine) {
      throw new Error(`No Engine defined for airline: ${airline}`)
    }

    // Wrap it in a class that implements the common functionality
    return new Engine(airline.toUpperCase(), engine)
  },

  supported: (airline) => {
    const set = Object.keys(engines).sort().map(x => x.toUpperCase())
    return (typeof airline === 'string') ? set.includes(airline) : set
  },

  ...require('./data'),

  // Export consts
  cabins,
  cabinCodes,

  // Export classes
  Award,
  BookingClass,
  Config,
  Engine,
  Flight,
  Parser,
  Query,
  Results,
  Searcher,
  Segment
}
