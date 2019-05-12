const Searcher = require('../../Searcher')

const {
  errors
} = Searcher

module.exports = class extends Searcher {
  async search(page, query, results) {
    const {
      oneWay,
      fromCity,
      toCity,
      quantity
    } = query
    const departDate = query.departDateMoment()
    const returnDate = query.returnDateMoment()

    const awardReservationCheckbox = await page.$('#awardReservation');
    if (!(await (await awardReservationCheckbox.getProperty('checked')).jsonValue())) {
      await page.click('#awardReservation');
    }

    await page.evaluate((oneWay) => {
      if (oneWay) {
        document.querySelector('#oneWay').click();
      }
    }, oneWay)

    const formValues = {}
    formValues['flightType'] = oneWay ? '2' : '1'
    formValues['ShoppingRequestModel.DepartureCity1'] = fromCity
    formValues['ShoppingRequestModel.ArrivalCity1'] = toCity
    formValues['ShoppingRequestModel.DepartureDate1'] = departDate.format('MM/DD/YY')
    formValues['ShoppingRequestModel.ReturnDate'] = returnDate ? returnDate.format('MM/DD/YY') : ''
    formValues['ShoppingRequestModel.AdultCount'] = `${quantity.toString()} adult${quantity > 1 ? 's' : ''}`
    formValues['ShoppingRequestModel.AwardOption'] = 'MilesOnly'

    await this.fillForm(formValues)

    // Submit the form
    await page.click('#findFlights');
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
          page.waitFor('#MatrixResultColumn', {
            timeout: 120000
          }),
          page.waitFor('.errorTextSummary', {
            timeout: 120000
          })
        ])
      } catch (err) {
        throw new Searcher.Error(`Stuck waiting for results to appear`)
      }

      // Ensure results exist and there are no errors
      if (!(await page.$('#MatrixResultColumn'))) {
        let msgError = await this.textContent('.errorTextSummary')
        if (msgError) {
          throw new Searcher.Error(`Website returned error: ${msgError}`)
        } else {
          throw new Searcher.Error('Unable to locate flight results')
        }
      }
      break
    }
  }
}