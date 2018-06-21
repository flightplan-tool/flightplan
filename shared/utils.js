const fs = require('fs')
const path = require('path')
const prompt = require('syncprompt')

const db = require('./db')

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

function changeExtension (strPath, ext) {
  if (!strPath) {
    return strPath
  }
  const { dir, base } = path.parse(strPath)
  if (!ext.startsWith('.')) {
    ext = '.' + ext
  }
  let pos = base.indexOf('.')
  if (pos < 0) {
    pos = base.length
  }
  return path.join(dir, base.slice(0, pos) + ext)
}

function assetsForRequest (request) {
  const { htmlFile, fileCount } = request

  // Compute all files associated with this request
  const assets = { htmlFiles: [], screenshots: [] }
  for (let index = 0; index < fileCount; index++) {
    let filename = htmlFile

    // Update the filename based on index
    if (index > 0) {
      filename = appendPath(filename, '-' + index)
    }

    // Keep track of every file associated with a request
    assets.htmlFiles.push(filename)
    assets.screenshots.push(changeExtension(filename, '.jpg'))
  }

  return assets
}

async function cleanupRequest (request) {
  // Get the files associated with this request
  const { htmlFiles, screenshots } = assetsForRequest(request)

  // Delete the files from disk
  for (const filename of [...htmlFiles, ...screenshots]) {
    if (fs.existsSync(filename)) {
      fs.unlinkSync(filename)
    }
  }

  // Remove from the database
  await db.db().run('DELETE FROM awards_requests WHERE id = ?', request.id)
}

function deepFreeze (obj, levels = -1) {
  // Do we have an array? If so, freeze each element
  if (Array.isArray(obj)) {
    obj = [...obj]
    for (let idx = 0; idx < obj.length; idx++) {
      const ele = obj[idx]
      if (typeof ele === 'object' && ele !== null) {
        obj[idx] = deepFreeze(ele, (levels > 0) ? levels - 1 : levels)
      }
    }
    return Object.freeze(obj)
  }

  // Handle objects with properties
  obj = {...obj}
  if (levels !== 0) {
    // Retrieve the property names defined on obj
    var propNames = Object.getOwnPropertyNames(obj)

    // Freeze properties before freezing self
    propNames.forEach((name) => {
      const prop = obj[name]
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
  changeExtension,
  assetsForRequest,
  cleanupRequest,
  deepFreeze,
  promptYesNo,
  randomInt,
  truthy
}
