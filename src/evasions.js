// initial evasions from @sangaline
//   https://intoli.com/blog/not-possible-to-block-chrome-headless/
//   https://intoli.com/blog/not-possible-to-block-chrome-headless/test-headless-final.js

module.exports = async function (page) {
  // Pass the User-Agent test
  const userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.181 Safari/537.36'
  await page.setUserAgent(userAgent)

  // Pass the Webdriver test
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false
    })
  })

  // Pass the screen dimensions test
  await page.evaluateOnNewDocument(() => {
    window.outerWidth = window.innerWidth
    window.screen = {
      availLeft: Math.floor(Math.random() * 40),
      availTop: Math.floor(Math.random() * 40),
      availWidth: 2560,
      availHeight: 1440 - 40,
      width: 2560,
      height: 1440,
      colorDepth: 24,
      pixelDepth: 24,
      orientation: {
        angle: 0,
        onchange: null,
        type: 'landscape-primary'
      }
    }
  })

  // Pass the Chrome test
  await page.evaluateOnNewDocument(() => {
    const startE = (new Date()).getTime()
    const onloadT = startE + (Math.floor(Math.random() * (800 - 10 + 1)) + 10)
    const offset = Math.floor(Math.random() * (1000 + 1)) / 1000

    // We can mock this in as much depth as we need for the test
    window.chrome = {
      csi: () => {
        return {
          startE,
          onloadT,
          pageT: (new Date()).getTime() - startE + offset,
          tran: 15
        }
      },
      loadTimes: () => {
        return {
          commitLoadTime: startE / 1000,
          connectioninfo: 'http/1.1',
          finishDocumentLoadTime: (startE + onloadT) / 1000,
          finishLoadTime: 0,
          firstPaintAfterLoadTime: 0,
          firstPaintTime: (startE + onloadT) / 1000,
          navigationType: 'Other',
          npnNegotiatedProtocol: 'unknown',
          requestTime: (startE / 1000) - offset,
          startLoadTime: (startE / 1000) - offset,
          wasAlternateProtocolAvailable: false,
          wasFetchedViaSpdy: false,
          wasNpnNegotiated: false
        }
      },
      webstore: {
        install: (url, onSuccess, onFailure) => {},
        onDownloadProgress: {},
        onInstallStageChanged: {}
      },
      get app () { return undefined },
      get runtime () { return undefined }
    }
  })

  // Pass the Permissions test
  await page.evaluateOnNewDocument(() => {
    const originalQuery = window.navigator.permissions.query
    window.navigator.permissions.__proto__.query = parameters =>
      parameters.name === 'notifications'
        ? Promise.resolve({state: Notification.permission})
        : originalQuery(parameters)

    // Inspired by: https://github.com/ikarienator/phantomjs_hide_and_seek/blob/master/5.spoofFunctionBind.js
    const oldCall = Function.prototype.call
    function call () {
      return oldCall.apply(this, arguments)
    }
    Function.prototype.call = call

    const nativeToStringFunctionString = Error.toString().replace(/Error/g, 'toString')
    const oldToString = Function.prototype.toString

    function functionToString () {
      if (this === window.navigator.permissions.query) {
        return 'function query() { [native code] }'
      }
      if (this === functionToString) {
        return nativeToStringFunctionString
      }
      return oldCall.call(oldToString, this)
    }
    Function.prototype.toString = functionToString
  })

  // Pass the Plugins Length test
  await page.evaluateOnNewDocument(() => {
    // Overwrite the `plugins` property to use a custom getter.
    Object.defineProperty(navigator, 'plugins', {
      // This just needs to have `length > 0` for the current test,
      // but we could mock the plugins too if necessary.
      get: () => [1, 2, 3, 4, 5]
    })
  })

  // Pass the Languages test
  await page.evaluateOnNewDocument(() => {
    // Overwrite the `plugins` property to use a custom getter.
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en']
    })
  })

  // NOTE: Causes issues with koreanair.com website
  // // Pass the iframe Test
  // await page.evaluateOnNewDocument(() => {
  //   Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
  //     get: function () {
  //       return window
  //     }
  //   })
  // })

  // Pass toString test, though it breaks console.debug() from working
  await page.evaluateOnNewDocument(() => {
    window.console.debug = () => {
      return null
    }
  })
}
