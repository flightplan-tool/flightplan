const moment = require('moment')

const Engine = require('../_base/engine')
const { cabins } = require('../../lib/consts')
const { randomInt } = require('../../lib/utils')

const URL_FLIGHT_SEARCH = 'www.google.com'

class JLEngine extends Engine {
  constructor (options) {
    super()
    this.options = options
  }

  static get config () {
    return {
      id: 'JL',
      name: 'Japan Airlines',
      fares: {
        FS: {cabin: cabins.first, saver: true},
        CS: {cabin: cabins.business, saver: true},
        WS: {cabin: cabins.premium, saver: true},
        YS: {cabin: cabins.economy, saver: true}
      },
      accountRequired: false,
      requestsPerHour: 85,
      throttlePeriod: 30 * 60,
      oneWaySupported: true,
      tripMinDays: 3,
      validation: {
        minDays: 1,
        maxDays: 355
      }
    }
  }

  async initialize () {
    return true
  }

  async search (query) {
    return true
  }
}

module.exports = JLEngine
