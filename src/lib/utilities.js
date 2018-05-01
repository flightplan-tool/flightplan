import moment from 'moment'

import { MONTH_LABELS } from './constants'

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

function getMonthIndexFromDate (date) {
  return parseInt(moment(date).format('M'), 10) - 1
}

function getDayIndexFromDate (date) {
  return parseInt(moment(date).format('D'), 10) - 1
}

function getMonthIndex (month) {
  var index = parseInt(month.replace(/^0+/, ''), 10) - 1

  return index
}

function getMonthSlug (month) {
  return String((month < 10) ? '0' + month : month)
}

function getDaySlug (day) {
  return String((day < 10) ? '0' + day : day)
}

function getMonthLabel (monthIndex) {
  return MONTH_LABELS[monthIndex]
}

export {
  shadeColor,
  getDateISO,
  getMonthIndexFromDate,
  getDayIndexFromDate,
  getMonthIndex,
  getMonthSlug,
  getDaySlug,
  getMonthLabel
}
