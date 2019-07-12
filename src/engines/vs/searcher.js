const Searcher = require('../../Searcher')
const {
  cabins
} = require('../../consts')

const {
  errors
} = Searcher

module.exports = class extends Searcher {
  async search(page, query, results) {
    const {
      oneWay,
      fromCity,
      toCity,
      cabin,
      quantity
    } = query
    const departDate = query.departDateMoment()
    const returnDate = query.returnDateMoment()

    // Get cabin values
    const cabinCode = {
      [cabins.first]: 'VSUP',
      [cabins.business]: 'VSUP',
      [cabins.premium]: 'VSPE',
      [cabins.economy]: 'VSLT'
    }

    const formFields = {
      originCity: fromCity,
      origin: fromCity,
      destinationCity: toCity,
      destination: toCity,
      departureDate: departDate.format('MM/DD/YYYY'),
      returnDate: !oneWay ? returnDate.format('MM/DD/YYYY') : '',
      returndropdown: oneWay ? 'One way' : 'Return',
      cabinFareClass: cabinCode[cabin],
      flightsFor: '0',
      payment: 'Pay with miles'
    }
    formFields['paxCounts[0]'] = quantity.toString()

    await this.fillForm(formFields)

    // Trigger the return change event
    await page.evaluate(() => {
      document.getElementById('returndropdown').onchange()
    })

    //Trigger the payment click event
    await page.evaluate(() => {
      document.getElementById('payWithMiles').onclick()
    })

    // Submit the form
    await page.click('#findFlightsSubmit');
    await page.waitFor(3000)

    // Wait for results to load
    await this.settle()

    // Save the results
    await results.saveHTML('results')
  }

  async settle() {
    const {
      page
    } = this

    while (true) {
      try {
        await Promise.race([
          page.waitFor('#fareMatrix', {
            timeout: 120000
          }),
          page.waitFor('.warningContainer', {
            timeout: 120000
          }),
          page.waitFor('h1', {
            timeout: 120000
          })
        ])
      } catch (err) {
        throw new Searcher.Error(`Stuck waiting for results to appear`)
      }

      const errorMessage = await this.textContent('h1')
      if (errorMessage.trim().toLowerCase() === 'access denied') {
        throw new errors.BlockedAccess()
      }

      const warningMessage = await this.textContent('.warningText')
      if (warningMessage.trim().toLowerCase().indexOf('please use a single browser') != -1) {
        throw new errors.BotDetected()
      }

      // Click on every 'Flight and cabin information' link so that we can capture flight details in the DOM
      const detailLinksLength = await page.evaluate(() => {
        return document.getElementsByClassName('fm_showdetailswrap').length
      })
      for (let i = 0; i < detailLinksLength; i++) {
        await page.evaluate((i) => {
          document.querySelectorAll('.fm_showdetailswrap')[i].click()
        }, i)
        await page.waitFor(`#compareOverlayCloseButton${i}`)
        await page.click(`#compareOverlayCloseButton${i}`)
        await page.waitFor(100)
      }
      break
    }
  }
}