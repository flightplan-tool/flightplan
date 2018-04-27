const truthyValues = {'true': 1, '1': 1, 'yes': 1, 'y': 1}

function randomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function truthy (val) {
  return val && val.toString().toLowerCase() in truthyValues
}

function printRoute (query) {
  const { engine, fromCity, toCity, departDate, returnDate, adults, children } = query

  // Passenger details
  const strPax = [
    adults === 0 ? undefined : (adults === 1) ? '1 Adult' : `${adults} Adults`,
    children === 0 ? undefined : (children === 1) ? '1 Child' : `${children} Children`
  ].filter(x => !!x).join(', ')

  // Format dates if necessary
  departStr = (departDate && typeof departDate !== 'string')
    ? departDate.format('L') : departDate
  returnStr = (returnDate && typeof returnDate !== 'string')
    ? returnDate.format('L') : returnDate

  // Print departure and arrival routes
  console.log(`${engine}: DEPARTURE [${fromCity} -> ${toCity}] - ${departStr} (${strPax})`)
  if (returnDate) {
    console.log(`${engine}: ARRIVAL   [${toCity} -> ${fromCity}] - ${returnStr}`)
  }
}

module.exports = {
  randomInt,
  truthy,
  printRoute
}
