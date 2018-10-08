module.exports = {
  cabins: {
    first: 'first',
    business: 'business',
    premium: 'premium',
    economy: 'economy'
  },
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
      delayBetweenRequests: ['00:00:30', '00:00:45'],
      requestsPerHour: 45,
      restPeriod: ['00:10', '00:25']
    },
    normal: {
      delayBetweenRequests: ['00:00:20', '00:00:30'],
      requestsPerHour: 60,
      restPeriod: ['00:15', '00:30']
    },
    fast: {
      delayBetweenRequests: ['00:00:05', '00:00:20'],
      requestsPerHour: 90,
      restPeriod: ['00:20', '00:40']
    }
  }
}
