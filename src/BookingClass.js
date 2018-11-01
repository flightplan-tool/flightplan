const consts = require('./consts')
const utils = require('./utils')

class BookingClass {
  constructor (settings) {
    // Read attributes and apply defaults
    const {
      code,
      cabin,
      saver = true,
      name
    } = settings

    // Validate cabin
    if (!(cabin in consts.cabins)) {
      throw new Error(`Invalid booking class cabin: ${cabin}`)
    }

    // Set internal state
    this._state = Object.freeze({
      code,
      cabin,
      saver,
      name
    })
  }

  toJSON () {
    return { ...this._state }
  }

  toString () {
    return utils.ppJSON(this.toJSON())
  }

  get code () {
    return this._state.code
  }

  get cabin () {
    return this._state.cabin
  }

  get saver () {
    return this._state.saver
  }

  get name () {
    return this._state.name
  }
}

module.exports = BookingClass
