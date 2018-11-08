module.exports = {
  cabins: Object.freeze({
    first: 'first',
    business: 'business',
    premium: 'premium',
    economy: 'economy'
  }),
  cabinCodes: Object.freeze({
    first: 'F',
    business: 'J',
    premium: 'W',
    economy: 'Y'
  }),
  defaults: {
    config: {
      waitUntil: 'networkidle0',
      roundtripOptimized: true,
      tripMinDays: 3,
      oneWaySupported: true
    },
    options: {
      parse: true,
      args: [],
      headless: false,
      proxy: undefined,
      throttle: true,
      timeout: 90000,
      verbose: true
    }
  },
  profiles: {
    slow: {
      delayBetweenRequests: ['00:30', '00:45'],
      requestsPerHour: 45,
      restPeriod: ['10:00', '25:00']
    },
    normal: {
      delayBetweenRequests: ['00:20', '00:30'],
      requestsPerHour: 60,
      restPeriod: ['15:00', '30:00']
    },
    fast: {
      delayBetweenRequests: ['00:05', '00:20'],
      requestsPerHour: 90,
      restPeriod: ['20:00', '40:00']
    }
  }
}
