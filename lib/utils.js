const prompt = require('syncprompt')

const truthyValues = {'true': 1, '1': 1, 'yes': 1, 'y': 1}

function randomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function truthy (val) {
  return val && val.toString().toLowerCase() in truthyValues
}

function printRoute (query) {
  const { method, fromCity, toCity, departDate, returnDate, quantity } = query

  // Passenger details
  const strPax = `${quantity} ${quantity > 1 ? 'Passengers' : 'Passenger'}`

  // Format dates if necessary
  const departStr = (departDate && typeof departDate !== 'string')
    ? departDate.format('L') : departDate
  const returnStr = (returnDate && typeof returnDate !== 'string')
    ? returnDate.format('L') : returnDate

  // Print departure and arrival routes
  console.log(`${method}: DEPARTURE [${fromCity} -> ${toCity}] - ${departStr} (${strPax})`)
  if (returnDate) {
    console.log(`${method}: ARRIVAL   [${toCity} -> ${fromCity}] - ${returnStr}`)
  }
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

module.exports = {
  randomInt,
  truthy,
  printRoute,
  promptYesNo
}
