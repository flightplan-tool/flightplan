const path = require('path')
const prompt = require('syncprompt')

function appendPath (strPath, str) {
  if (!strPath) {
    return strPath
  }
  const { dir, base } = path.parse(strPath)
  let pos = base.indexOf('.')
  if (pos < 0) {
    pos = base.length
  }
  return path.join(dir, base.slice(0, pos) + str + base.slice(pos))
}

function deepFreeze (obj, levels = -1) {
  obj = {...obj}
  if (levels !== 0) {
    // Retrieve the property names defined on obj
    var propNames = Object.getOwnPropertyNames(obj)

    // Freeze properties before freezing self
    propNames.forEach((name) => {
      var prop = obj[name]
      if (typeof prop === 'object' && prop !== null) {
        obj[name] = deepFreeze(prop, (levels > 0) ? levels - 1 : levels)
      }
    })
  }
  return Object.freeze(obj)
}

function promptYesNo (question, defaultChoice = 'yes') {
  const valid = { 'yes': true, 'y': true, 'no': false, 'n': false }

  let strPrompt = ' [y/n] '
  if (defaultChoice === 'yes') {
    strPrompt = ' [Y/n] '
  } else if (defaultChoice === 'no') {
    strPrompt = ' [y/N] '
  } else if (defaultChoice) {
    throw new Error('Invalid defaultChoice: ' + defaultChoice)
  }

  while (true) {
    const choice = prompt(question + strPrompt).toLowerCase()
    if (defaultChoice && choice === '') {
      return valid[defaultChoice]
    } else if (choice in valid) {
      return valid[choice]
    } else {
      console.log(`Please respond with 'yes' or 'no' (or 'y' or 'n').`)
    }
  }
}

function randomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function truthy (val) {
  const truthyValues = { 'true': 1, '1': 1, 'yes': 1, 'y': 1 }
  return val && val.toString().toLowerCase() in truthyValues
}

module.exports = {
  appendPath,
  deepFreeze,
  promptYesNo,
  randomInt,
  truthy
}
