const truthyValues = {'true': 1, '1': 1, 'yes': 1, 'y': 1}

function randomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function truthy (val) {
  return val && val.toString().toLowerCase() in truthyValues
}

module.exports = {
  randomInt,
  truthy
}
