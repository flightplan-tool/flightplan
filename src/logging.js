module.exports = (Base) => class extends Base {
  verbose () {
    const { verbose = true } = this.options || {}
    return verbose
  }

  success () {
    if (this.verbose()) {
      console.log(this.config.id + ':', ...arguments)
    }
  }

  info () {
    if (this.verbose()) {
      console.log(this.config.id + ':', ...arguments)
    }
  }

  warn () {
    if (this.verbose()) {
      console.log(this.config.id + ':', ...arguments)
    }
  }

  error () {
    if (this.verbose()) {
      console.error(this.config.id + ':', ...arguments)
    }
  }
}
