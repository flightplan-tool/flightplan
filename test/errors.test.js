const fp = require('../src/index')
const accounts = require('../shared/accounts')

const { cabins } = fp
const { errors } = fp.Searcher

// describe(`Invalid login credentials`, () => {
//   for (const id of fp.supported()) {
//     if (fp.new(id).loginRequired) {
//       test(`${id}: Invalid login credentials`, async () => {
//         const engine = fp.new(id)
//         const credentials = accounts.getCredentials(engine.id)

//         // Mess up the login credentials
//         credentials[0] = (parseInt(credentials[0]) - 101).toString()

//         // Initialize engine
//         await engine.initialize({ credentials, headless: true, verbose: false, throttle: false })
//         try {
//           // Make sure login fails
//           await expect(engine.login(1)).rejects.toThrow(errors.InvalidCredentials)
//         } finally {
//           await engine.close()
//         }
//       })
//     }
//   }
// })

describe(`Invalid routes`, () => {
  // test(`AC: UBS-XYZ`, async () => {
  //   // Create and initialize engine
  //   const engine = fp.new('AC')
  //   try {
  //     const credentials = accounts.getCredentials(engine.id)
  //     await engine.initialize({ credentials, headless: true, verbose: false, throttle: false })

  //     // Make sure we get an INVALID_ROUTE error
  //     const query = { fromCity: 'UBS', toCity: 'XYZ', cabin: cabins.economy, departDate: '2019-09-01' }
  //     await expect(engine.search(query)).rejects.toThrow(errors.InvalidRoute)
  //     query.returnDate = '2019-09-04'
  //     await expect(engine.search(query)).rejects.toThrow(errors.InvalidRoute)
  //   } finally {
  //     await engine.close()
  //   }
  // })

  test(`BA: CMH-XYZ, CMH-ZSA`, async () => {
    // Create and initialize engine
    const engine = fp.new('BA')
    try {
      const credentials = accounts.getCredentials(engine.id)
      await engine.initialize({ credentials, headless: true, verbose: false, throttle: false })

      // Make sure we get a SearcherError
      const query = { fromCity: 'CMH', toCity: 'XYZ', cabin: cabins.economy, departDate: '2019-09-01' }
      await expect(engine.search(query)).rejects.toThrow(fp.Searcher.Error)

      // Make sure we get an INVALID_ROUTE error
      query.toCity = 'ZSA'
      await expect(engine.search(query)).rejects.toThrow(errors.InvalidRoute)
    } finally {
      await engine.close()
    }
  })
})
