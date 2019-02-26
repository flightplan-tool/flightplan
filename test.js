const puppeteer = require('puppeteer')
const applyEvasions = require('./src/evasions')

const main = async () => {
  const args = [ `--window-size=1200,900` ]
  const browser = await puppeteer.launch({ headless: false, args })
  const page = (await browser.pages())[0]
  await page._client.send('Emulation.clearDeviceMetricsOverride')
  applyEvasions(page, { maskWebRTC: true, maskPublicIP: '50.207.175.42' })
    .then(() => page.goto('https://www.britishairways.com/travel/redeem/execclub/_gf/en_us?eId=106019&tab_selected=redeem&redemption_type=STD_RED'))
    .catch((err) => console.log(err))
}

main()
