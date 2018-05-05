const moment = require('moment')

const Engine = require('../_base/engine')
const { cabins } = require('../../lib/consts')
const { randomInt } = require('../../lib/utils')

const URL_FLIGHT_SEARCH = 'www.google.com'

class CXEngine extends Engine {
  constructor (options) {
    super()
    this.options = options
  }

  static get config () {
    return {
      id: 'CX',
      name: 'Cathay Pacific',
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
      },
      accountRequired: true,
      requestsPerHour: 85,
      throttlePeriod: 30 * 60,
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

module.exports = CXEngine
