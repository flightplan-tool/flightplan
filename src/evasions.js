const utils = require('./utils')

// initial evasions from @sangaline
//   https://intoli.com/blog/not-possible-to-block-chrome-headless/
//   https://intoli.com/blog/not-possible-to-block-chrome-headless/test-headless-final.js

module.exports = async function (page, options) {
  const {
    maskWebRTC = false,
    maskLocalIP = '192.168.1.100',
    maskPublicIP
  } = options

  // Initialize variables to store temporary data
  await page.evaluateOnNewDocument(() => {
    window.__customFn = new Map()
  })

  if (maskWebRTC) {
    // Discover proxy's external IP, using Chrome, if necessary
    let detectedIP
    if (!maskPublicIP) {
      await page.goto('https://www.icanhazip.com')
      detectedIP = await page.evaluate(() => document.querySelector('html').textContent.trim())
    }

    // Find the local / external IP addresses that we want to mask
    const publicIP = await utils.externalIP()
    const localIP = utils.localIP()
    const mapping = {
      [publicIP]: maskPublicIP || detectedIP,
      [localIP]: maskLocalIP
    }

    // Mask IP addresses leaked by WebRTC
    await page.evaluateOnNewDocument((mapping) => {
      const replaceIP = (str) => {
        if (str) {
          for (const [ orig, replacement ] of Object.entries(mapping)) {
            if (str.indexOf(orig) >= 0) {
              str = str.split(orig).join(replacement)
            }
          }
        }
        return str
      }

      const updateSDP = (session) => {
        if (session && session.sdp) {
          const json = session.toJSON()
          json.sdp = replaceIP(json.sdp)
          return new RTCSessionDescription(json)
        }
        return session
      }

      const OrigRTCPeerConnection = window.RTCPeerConnection
      window.RTCPeerConnection = class RTCPeerConnection extends OrigRTCPeerConnection {
        set onicecandidate (handler) {
          super.onicecandidate = (event) => {
            if (event.candidate) {
              event.candidate.candidate = replaceIP(event.candidate.candidate)
            }
            handler(event)
          }
        }

        get currentLocalDescription () {
          return updateSDP(super.currentLocalDescription)
        }

        get currentRemoteDescription () {
          return updateSDP(super.currentRemoteDescription)
        }

        get localDescription () {
          return updateSDP(super.localDescription)
        }

        get pendingLocalDescription () {
          return updateSDP(super.pendingLocalDescription)
        }

        get pendingRemoteDescription () {
          return updateSDP(super.pendingRemoteDescription)
        }

        get remoteDescription () {
          return updateSDP(super.remoteDescription)
        }
      }
      window.__customFn.set(window.RTCPeerConnection, 'function RTCPeerConnection() { [native code] }')
    }, mapping)
  }

  // Pass the User-Agent test
  const osVersions = [
    '10_12_0', '10_12_1', '10_12_2', '10_12_3', '10_12_4', '10_12_5', '10_12_6',
    '10_13_0', '10_13_1', '10_13_2', '10_13_3', '10_13_4', '10_13_5', '10_13_6',
    '10_14_0', '10_14_1'
  ]
  const browserVersions = [
    '52.0.2743.116', '53.0.2785.89', '54.0.2840.71', '55.0.2703.95 ', '56.0.2924.87', '57.0.2987.133', '58.0.3029.110', '59.0.3077.58',
    '60.0.3112.78', '61.0.3163.100', '62.0.3198.0', '63.0.3239.132', '64.0.3282.119', '65.0.3325.146', '67.0.3396.99', '68.0.3440.106', '69.0.3497.100',
    '70.0.3538.77', '71.0.3578.98 '
  ]
  const osVersion = osVersions[Math.floor(Math.random() * osVersions.length)]
  const browserVersion = browserVersions[Math.floor(Math.random() * browserVersions.length)]
  // const userAgent =
  //   `Mozilla/5.0 (Macintosh; Intel Mac OS X ${osVersion}) ` +
  //   `AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.109 Safari/537.36'
  await page.setUserAgent(userAgent)

  // Pass the Webdriver test
  await page.evaluateOnNewDocument(() => {
    delete Navigator.prototype.webdriver
  })

  // Pass WebGL test
  await page.evaluateOnNewDocument(() => {
    WebGLRenderingContext.prototype.getSupportedExtensions = () => {
      return [
        'ANGLE_instanced_arrays',
        'EXT_blend_minmax',
        'EXT_color_buffer_half_float',
        'EXT_disjoint_timer_query',
        'EXT_frag_depth',
        'EXT_shader_texture_lod',
        'EXT_texture_filter_anisotropic',
        'WEBKIT_EXT_texture_filter_anisotropic',
        'EXT_sRGB',
        'OES_element_index_uint',
        'OES_standard_derivatives',
        'OES_texture_float',
        'OES_texture_float_linear',
        'OES_texture_half_float',
        'OES_texture_half_float_linear',
        'OES_vertex_array_object',
        'WEBGL_color_buffer_float',
        'WEBGL_compressed_texture_s3tc',
        'WEBKIT_WEBGL_compressed_texture_s3tc',
        'WEBGL_compressed_texture_s3tc_srgb',
        'WEBGL_debug_renderer_info',
        'WEBGL_debug_shaders',
        'WEBGL_depth_texture',
        'WEBKIT_WEBGL_depth_texture',
        'WEBGL_draw_buffers',
        'WEBGL_lose_context',
        'WEBKIT_WEBGL_lose_context'
      ]
    }

    // Get a WebGL context
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('webgl')

    // Customize parameters
    const originalGetParam = WebGLRenderingContext.prototype.getParameter
    WebGLRenderingContext.prototype.getParameter = (param) => {
      switch (param) {
        case WebGLRenderingContext.prototype.ALIASED_POINT_SIZE_RANGE:
          return [1, 8191]
        case WebGLRenderingContext.prototype.MAX_COMBINED_TEXTURE_IMAGE_UNITS:
          return 80
        case WebGLRenderingContext.prototype.MAX_CUBE_MAP_TEXTURE_SIZE:
          return 16384
        case WebGLRenderingContext.prototype.MAX_FRAGMENT_UNIFORM_VECTORS:
          return 1024
        case WebGLRenderingContext.prototype.MAX_RENDERBUFFER_SIZE:
          return 16384
        case WebGLRenderingContext.prototype.MAX_TEXTURE_SIZE:
          return 16384
        case WebGLRenderingContext.prototype.MAX_VERTEX_ATTRIBS:
          return 16
        case WebGLRenderingContext.prototype.MAX_VERTEX_UNIFORM_VECTORS:
          return 1024
        case WebGLRenderingContext.prototype.MAX_VIEWPORT_DIMS:
          return [16384, 16384]
        case 34047:
          return 16
      }
      return originalGetParam.call(ctx, param)
    }

    // Customize extensions
    const originalGetExt = WebGLRenderingContext.prototype.getExtension
    WebGLRenderingContext.prototype.getExtension = (param) => {
      if (param === 'EXT_texture_filter_anisotropic') {
        return { MAX_TEXTURE_MAX_ANISOTROPY_EXT: 34047 }
      }
      return originalGetExt.call(ctx, param)
    }
  })

  // Pass the screen dimensions test
  await page.evaluateOnNewDocument(() => {
    const getOuterWidth = () => { return window.innerWidth }
    const setOuterWidth = (val) => { window.outerWidth = val }
    const getOuterHeight = () => { return window.innerHeight + 110 }
    const setOuterHeight = (val) => { window.outerHeight = val }

    Object.defineProperties(window, {
      'outerWidth': {
        get: getOuterWidth, set: setOuterWidth, enumerable: true, configurable: true
      },
      'outerHeight': {
        get: getOuterHeight, set: setOuterHeight, enumerable: true, configurable: true
      }
    })

    window.__customFn.set(getOuterWidth, 'function get outerWidth() { [native code] }')
    window.__customFn.set(setOuterWidth, 'function set outerWidth() { [native code] }')
    window.__customFn.set(getOuterHeight, 'function get outerHeight() { [native code] }')
    window.__customFn.set(setOuterHeight, 'function set outerHeight() { [native code] }')
  })

  // Pass the touch support test
  await page.evaluateOnNewDocument(() => {
    const getMaxTouchPoints = () => 0
    Object.defineProperty(
      Object.getPrototypeOf(navigator),
      'maxTouchPoints',
      { get: getMaxTouchPoints, enumerable: true, configurable: true }
    )
    window.__customFn.set(getMaxTouchPoints, 'function get maxTouchPoints() { [native code] }')

    const originalCreateEvent = document.createEvent

    document.__proto__.createEvent = (type) => {
      if (type === 'TouchEvent') {
        throw new DOMException(`Failed to execute 'createEvent' on 'Document': The provided event type ('TouchEvent') is invalid.`, 'NotSupportedError')
      } else {
        return originalCreateEvent.call(document, type)
      }
    }
    window.__customFn.set(document.createEvent, 'function createEvent() { [native code] }')

    delete window.ontouchstart
  })

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
    window.__customFn.set(window.navigator.permissions.query, 'function query() { [native code] }')
  })

  // Pass the Plugins Length test
  await page.evaluateOnNewDocument(() => {
    const mimeTypes = []

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
        mimeTypes.push(mt)
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
    window.__customFn.set(getPlugins, 'function get plugins() { [native code] }')

    // Set plugins on the PluginArray
    plugins.forEach((x, idx) => addPlugin(idx, x))

    // Set PluginArray length
    const getPluginsLength = () => plugins.length
    Object.defineProperty(
      Object.getPrototypeOf(navigator.plugins),
      'length',
      { get: getPluginsLength, enumerable: true, configurable: true }
    )
    window.__customFn.set(getPluginsLength, 'function get length() { [native code] }')

    // Create a new MimeTypeArray
    const mimeTypeArr = Object.create(navigator.mimeTypes)
    const getMimeTypes = () => mimeTypeArr
    Object.defineProperty(
      Object.getPrototypeOf(navigator),
      'mimeTypes',
      { get: getMimeTypes, enumerable: true, configurable: true }
    )
    window.__customFn.set(getMimeTypes, 'function get mimeTypes() { [native code] }')

    // Set mime types on the MimeTypeArray
    mimeTypes.sort((a, b) => {
      return (a.type < b.type) ? -1 : ((a.type > b.type) ? 1 : 0)
    }).forEach((mt, idx) => {
      // Each MimeType is accessible via index and type value
      Object.defineProperties(navigator.mimeTypes, {
        [idx]: { value: mt, writable: false, enumerable: true, configurable: true },
        [mt.type]: { value: mt, writable: false, enumerable: false, configurable: true }
      })
    })

    // Set MimeTypeArray length
    const getMimeTypesLength = () => mimeTypes.length
    Object.defineProperty(
      Object.getPrototypeOf(navigator.mimeTypes),
      'length',
      { get: getMimeTypesLength, enumerable: true, configurable: true }
    )
    window.__customFn.set(getMimeTypesLength, 'function get length() { [native code] }')
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
        return customFn.get(this)
      }

      // All other functions are treated normally
      return fnStr
    }
    Function.prototype.toString = functionToString

    // Cleanup the custom functions array
    delete window.__customFn
  })
}
