function coerceBoolean (val, defaultVal) {
  return (typeof val === 'boolean')
    ? val
    : ((typeof val === 'string') ? truthy(val) : defaultVal)
}

function coerceNumber (val, defaultVal) {
  val = parseInt(val, 10)
  return isNaN(val) ? defaultVal : val
}

function strcmp () {
  for (let i = 0; i < arguments.length - 1; i += 2) {
    const a = arguments[i]
    const b = arguments[i + 1]
    if (a !== b) {
      if (a < b) {
        return -1
      } else {
        return 1
      }
    }
  }
  return 0
}

/**
 * Helper method to darken or lighten color
 * @param  {string} color [HEX color code]
 * @param  {int} percent [percentage to lighten or darken base color]
 * @return {string} [Calculated HEX color code]
 */
function shadeColor (color, percent) {
  var f = parseInt(color.slice(1), 16)
  var t = percent < 0 ? 0 : 255
  var p = percent < 0 ? percent * -1 : percent
  var R = f >> 16
  var G = (f >> 8) & 0x00FF
  var B = f & 0x0000FF
  return '#' + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 +
      (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B))
    .toString(16).slice(1)
}

/**
 * Return date in ISO format
 * @param  {String} date [Any valid date string]
 * @return {String}      [ISO formated date]
 */
function getDateISO (date) {
  return new Date(date)
}

function getMonthIndex (month) {
  var index = parseInt(month.replace(/^0+/, ''), 10) - 1

  return index
}

function truthy (val) {
  const truthyValues = { 'true': 1, '1': 1, 'yes': 1, 'y': 1 }
  return val && val.toString().toLowerCase() in truthyValues
}

export {
  coerceBoolean,
  coerceNumber,
  strcmp,
  shadeColor,
  getDateISO,
  getMonthIndex,
  truthy
}
