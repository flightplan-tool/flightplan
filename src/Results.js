const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const Award = require('./Award')
const Flight = require('./Flight')
const Query = require('./Query')
const Segment = require('./Segment')
const utils = require('./utils')

const assetTypes = [ 'html', 'json', 'screenshot' ]

class Results {
  constructor (engine, query) {
    this._state = {
      engine: engine.id,
      query,
      html: [],
      json: [],
      screenshot: [],
      $: new Map(),
      error: null
    }
    this._engine = engine
  }

  static parse (json) {
    const { engine, query, error, flights } = json

    // Validate query
    if (!query) {
      throw new Error(`The "query" key is required to parse Results from JSON`)
    }

    // Need the engine's config
    const { config } = Results._findEngine(engine)

    // Create new instance
    const instance = Object.create(this.prototype)
    instance._state = {
      engine,
      query: new Query(query),
      html: [],
      json: [],
      screenshot: [],
      $: new Map(),
      error: error ? new Error(error) : null
    }
    assetTypes.forEach(type => instance._populateAssets(type, json))

    // Reconstruct flights and awards
    if (flights) {
      instance._state.flights = []
      instance._state.awards = []
      for (const flight of flights) {
        const segments = flight.segments.map(x => new Segment(x))
        const awards = flight.awards.map(x => {
          const obj = { ...x }
          obj.fare = config.fares.find(f => f.code === x.fare)
          return new Award(obj)
        })
        instance._state.flights.push(new Flight(segments, awards))
        instance._state.awards.push(...awards)
      }
    }

    return instance
  }

  static _findEngine (id) {
    const module = Results._engines[id.toLowerCase()]
    if (!module) {
      throw new Error(`No Engine defined for airline: ${id}`)
    }
    return module
  }

  async saveHTML (name = 'default', contents = undefined) {
    this._checkFixedAssets()

    // If no HTML provided, extract it from the page
    if (contents === undefined) {
      contents = await this._engine.page.content()
    }
    return this._saveAsset('html', name, contents)
  }

  async saveJSON (name = 'default', contents) {
    this._checkFixedAssets()

    if (!contents) {
      throw new Error(`Results cannot save empty JSON asset: ${contents}`)
    }
    return this._saveAsset('json', name, contents)
  }

  async screenshot (name = 'default') {
    this._checkFixedAssets()

    return this._saveAsset('screenshot', name, null)
  }

  $ (name) {
    if (this._state.$.has(name)) {
      return this._state.$.get(name)
    }
    const contents = this.contents('html', name)
    if (!contents) {
      return null
    }
    const result = cheerio.load(contents)
    this._state.$.set(name, result)
    return result
  }

  contents (type, name) {
    if (!assetTypes.includes(type)) {
      throw new Error(`Invalid asset type: ${type}`)
    }

    // Find the asset
    const assets = this._state[type]
    const asset = assets.find(x => x.name === name)
    if (!asset) {
      return null
    }
    if (asset.contents) {
      return asset.contents
    }
    if (!asset.path) {
      return null
    }

    // Read file, and decompress if necessary
    let contents = fs.readFileSync(asset.path)
    if (path.extname(asset.path) === '.gz') {
      contents = zlib.gunzipSync(contents)
    }
    if (type === 'json') {
      contents = JSON.parse(contents)
    }

    // Rebuild the frozen asset array
    this._state[type] = Object.freeze(assets.map(x => {
      return (x === asset) ? { ...x, contents } : x
    }))

    return contents
  }

  trimContents () {
    for (const type of assetTypes) {
      for (const asset of this._state[type]) {
        delete asset.contents
      }
    }
    return this
  }

  toJSON (includeAwards = false) {
    const { engine, query, error } = this._state
    const ret = { engine, query: query.toJSON() }
    if (error) {
      ret.error = error.message
    }
    assetTypes.forEach(type => {
      const assets = this._state[type]
      if (assets.length > 0) {
        ret[type] = assets.map(x => {
          const asset = { ...x }
          if (asset.contents && type === 'screenshot') {
            asset.contents = asset.contents.toString('base64')
          }
          return asset
        })
      }
    })
    if (includeAwards) {
      const { flights } = this
      ret.flights = flights ? flights.map(x => x.toJSON(true)) : null
    }
    return ret
  }

  toString () {
    return utils.ppJSON(this.toJSON())
  }

  get ok () {
    return !this._state.error
  }

  get error () {
    return this._state.error
  }

  get engine () {
    return this._state.engine
  }

  get query () {
    return this._state.query
  }

  get assets () {
    const ret = {}
    assetTypes.forEach(type => { ret[type] = this._state[type] })
    return ret
  }

  get awards () {
    if (!('awards' in this._state)) {
      this._parseAwards()
    }
    return this._state.awards
  }

  get flights () {
    if (!('flights' in this._state)) {
      this._parseAwards()
    }
    return this._state.flights
  }

  _parseAwards () {
    // Can't parse if there was a searcher error
    if (this._state.error) {
      return
    }

    // Get Parser subclass
    const id = this._state.engine.toUpperCase()
    const module = Results._findEngine(id)
    const { parser: Parser, config } = module

    // Validate the Parser subclass
    if (!Parser) {
      throw new Error(`No Parser subclass defined for engine: ${id}`)
    }

    // Parse awards and flights
    let ret
    try {
      const parser = new Parser(id, config)
      parser._initialize(this)
      ret = parser.parse(this)
    } catch (err) {
      // Update state, so we don't trigger this error again
      this._state.flights = null
      this._state.awards = null

      // Handle Parser-specific errors differently
      if (err.constructor.name === 'ParserError') {
        this._setError(err)
        return
      } else {
        throw err
      }
    }

    if (!Array.isArray(ret)) {
      throw new Error(`Expected an Array of Flight or Award instance from \`Parser.parse()\`, got: ${ret}`)
    }

    // Separate and validate Award and Flight instances
    const results = { awards: [], flights: [] }
    for (const ele of ret) {
      if (ele.constructor.name === 'Flight') {
        // Ensure all flights have one or more awards
        if (ele.awards.length === 0) {
          throw new Error(`Orphaned Flight detected (has no associated awards): ${ele}`)
        }
        results.flights.push(ele)
      } else if (ele.constructor.name === 'Award') {
        // Ensure all awards have a flight
        if (!ele.flight) {
          throw new Error(`Orphaned Award detected (has no associated flight): ${ele}`)
        }
        results.awards.push(ele)
      }
    }

    // Ensure all flights are unique
    const allFlights = [...results.flights, ...results.awards.map(x => x.flight)]
    const uniqueFlights = Flight._dedupe(allFlights)
    const allAwards = [].concat(...uniqueFlights.map(x => x.awards))

    // Validate segment data
    for (const flight of uniqueFlights) {
      for (let i = 0; i < flight.segments.length; i++) {
        const segment = flight.segments[i]
        if (segment.duration < 0) {
          throw new Error(`Invalid segment duration: ${segment}`)
        } else if (i < flight.segments.length - 1 && segment.nextConnection < 0) {
          throw new Error(`Invalid segment nextConnection: ${segment}`)
        }
      }
    }

    this._state.flights = Object.freeze(uniqueFlights)
    this._state.awards = Object.freeze(allAwards)
  }

  async _saveAsset (type, name, contents) {
    const { query } = this._state
    const { page } = this._engine
    const options = query[type]
    const assets = this._state[type]
    const entry = { name, contents }

    if (type === 'screenshot' && !options.enabled) {
      return
    }

    if (options.path) {
      // Make path unique
      const index = assets.length
      entry.path = (index > 0)
        ? utils.appendPath(options.path, '-' + index)
        : options.path

      // Convert contents to string
      if (type === 'json') {
        contents = JSON.stringify(contents)
      }

      // Write contents to disk
      switch (type) {
        case 'html':
        case 'json':
          // Compress contents
          if (options.gzip) {
            if (path.extname(entry.path) !== '.gz') {
              entry.path += '.gz'
            }
            contents = zlib.gzipSync(contents)
          }

          // Write to disk
          fs.writeFileSync(entry.path, contents)
          break
        case 'screenshot':
          entry.contents = await page.screenshot({...options, path: entry.path})
          break
      }
    } else if (type === 'screenshot') {
      entry.contents = await page.screenshot({...options})
    }

    // Add the asset to internal state
    assets.push(entry)
  }

  _checkFixedAssets () {
    if (!this._engine) {
      throw new Error(`Results parsed from JSON are fixed, and cannot have new assets added`)
    }
  }

  _populateAssets (type, jsonObj) {
    // Get src and make sure it's an array
    const src = jsonObj[type] || []
    if (!Array.isArray(src)) {
      throw new Error(`Invalid Results ${type} assets: ${src}`)
    }

    // Copy assets one-by-one
    const dest = this._state[type]
    for (const asset of src) {
      let { name, contents, path } = asset

      // Make sure the asset is valid
      if (!name || typeof name !== 'string' || (path && typeof path !== 'string')) {
        throw new Error(`Invalid Results ${type} asset: ${asset}`)
      }
      if (contents && type !== 'json' && typeof contents !== 'string') {
        throw new Error(`Expected string-type contents for Results ${type} asset: ${asset}`)
      }

      // Convert screenshot contents back to Buffer
      if (contents && type === 'screenshot') {
        contents = Buffer.from(contents, 'base64')
      }

      // Create our own copy of the asset
      const copy = { name }
      if (contents) {
        copy.contents = contents
      }
      if (path) {
        copy.path = path
      }
      dest.push(Object.freeze(copy))
    }

    // Freeze the array (when parsed from JSON, we can no longer modify the list of assets)
    Object.freeze(dest)
  }

  _setError (err) {
    this._state.error = err
  }
}

module.exports = Results
