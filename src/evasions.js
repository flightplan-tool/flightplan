// initial evasions from @sangaline
//   https://intoli.com/blog/not-possible-to-block-chrome-headless/
//   https://intoli.com/blog/not-possible-to-block-chrome-headless/test-headless-final.js

module.exports = async function (page) {
  // Initialize variables to store temporary data
  await page.evaluateOnNewDocument(() => {
    window.__customFn = new Set()
  })

  // Pass the User-Agent test
  const userAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'
  await page.setUserAgent(userAgent)

  // Pass the Webdriver test
  await page.evaluateOnNewDocument(() => {
    delete Navigator.prototype.webdriver
  })

  // // Pass the screen dimensions test
  // await page.evaluateOnNewDocument(() => {
  //   window.outerWidth = window.innerWidth
  //   const obj = {
  //     availLeft: 0,
  //     availTop: 22,
  //     availWidth: 2560,
  //     availHeight: 1354,
  //     width: 2560,
  //     height: 1440,
  //     colorDepth: 24,
  //     pixelDepth: 24
  //   }
  //   const defs = Object.entries(obj).reduce((newObj, [key, value]) => {
  //     newObj[key] = { get: () => value, enumerable: true, configurable: true }
  //     return newObj
  //   }, {})
  //   Object.defineProperties(Object.getPrototypeOf(window.screen), defs)
  //   Object.values(defs).forEach(x => { window.__customFn.add(x.get) })
  // })

  // Pass history length test
  await page.evaluateOnNewDocument(() => {
    let entries = 3 + Math.floor(Math.random() * 12)
    while (entries > 0) {
      history.pushState({}, '', '')
      entries--
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
    window.navigator.permissions.__proto__.query = function query (parameters) {
      return parameters.name === 'notifications'
        ? Promise.resolve({state: Notification.permission})
        : originalQuery(parameters)
    }
    window.__customFn.add(window.navigator.permissions.query)
  })

  // Pass the Plugins Length test
  await page.evaluateOnNewDocument(() => {
    const addPlugin = (idx, obj) => {
      // Create the Plugin object
      const plugin = Object.create(Plugin.prototype, {
        name: { value: obj.name },
        description: { value: obj.description },
        filename: { value: obj.filename },
        length: { value: obj.mimeTypes.length }
      })

      // Create it's MimeType's
      obj.mimeTypes.map(mtObj => {
        const mt = Object.create(MimeType.prototype, {
          type: { value: mtObj.type },
          suffixes: { value: mtObj.suffixes },
          description: { value: mtObj.description },
          enabledPlugin: { value: plugin }
        })
        return mt
      }).forEach((mt, idx) => {
        // Each MimeType is accessible via index and type value
        Object.defineProperties(plugin, {
          [idx]: { value: mt, writable: false, enumerable: true, configurable: true },
          [mt.type]: { value: mt, writable: false, enumerable: false, configurable: true }
        })
      })

      // Add the plugin to the PluginArray
      Object.defineProperties(navigator.plugins, {
        [idx]: { value: plugin, writable: false, enumerable: true, configurable: true },
        [plugin.name]: { value: plugin, writable: false, enumerable: false, configurable: true }
      })
    }

    const plugins = [
      {
        name: 'Chrome PDF Plugin',
        description: 'Portable Document Format',
        filename: 'internal-pdf-viewer',
        mimeTypes: [
          { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' }
        ]
      },
      {
        name: 'Chrome PDF Viewer',
        description: '',
        filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
        mimeTypes: [
          { type: 'application/pdf', suffixes: 'pdf', description: '' }
        ]
      },
      {
        name: 'Native Client',
        description: '',
        filename: 'internal-nacl-plugin',
        mimeTypes: [
          { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },
          { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable' }
        ]
      }
    ]

    // Create a new PluginArray
    const pluginArr = Object.create(navigator.plugins)
    const getPlugins = () => pluginArr
    Object.defineProperty(
      Object.getPrototypeOf(navigator),
      'plugins',
      { get: getPlugins, enumerable: true, configurable: true }
    )
    window.__customFn.add(getPlugins)

    // Set plugins on the PluginArray
    plugins.forEach((x, idx) => addPlugin(idx, x))

    // Set PluginArray length
    const getPluginsLength = () => plugins.length
    Object.defineProperty(
      Object.getPrototypeOf(navigator.plugins),
      'length',
      { get: getPluginsLength, enumerable: true, configurable: true }
    )
    window.__customFn.add(getPluginsLength)
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

  // Pass Function.toString() test
  await page.evaluateOnNewDocument(() => {
    const reFunction = /function\s+(.*?)\s*\((.*?)\)\s*{([^]*)}/
    const oldToString = Function.prototype.toString
    const customFn = window.__customFn

    // Inspired by: https://github.com/ikarienator/phantomjs_hide_and_seek/blob/master/5.spoofFunctionBind.js
    const oldCall = Function.prototype.call
    function call () {
      return oldCall.apply(this, arguments)
    }
    Function.prototype.call = call

    function functionToString () {
      const fnStr = oldCall.call(oldToString, this)
      if (this === functionToString) {
        // toString() was called on itself
        return 'function toString() { [native code] }'
      } else if (customFn.has(this)) {
        // Make this function look like it's native code
        const match = reFunction.exec(fnStr)
        if (match) {
          return `function ${match[1]}() { [native code] }`
        }

        // Couldn't match up function components properly, just return standard-looking anonymous function
        return 'function () { [native code] }'
      }

      // All other functions are treated normally
      return fnStr
    }
    Function.prototype.toString = functionToString

    // Cleanup the custom functions array
    delete window.__customFn
  })
}
