const chalk = require('chalk')

function success () {
  const { context, args } = opts(arguments)
  console.log(...(context ? [chalk.black(chalk.bgGreen(context))] : []), chalk.green('success'), ...args)
}

function info () {
  const { context, args } = opts(arguments)
  console.log(...(context ? [chalk.black(chalk.bgBlue(context))] : []), chalk.blue('info'), ...args)
}

function warn () {
  const { context, args } = opts(arguments)
  console.log(...(context ? [chalk.black(chalk.bgYellow(context))] : []), chalk.yellow('warning'), ...args)
}

function error () {
  const { context, args } = opts(arguments)
  console.log(...(context ? [chalk.black(chalk.bgRed(context))] : []), chalk.red('error'), ...args)
}

function opts (params) {
  if (params.length === 1 && typeof params[0] === 'object' && params[0].args) {
    return params[0]
  }
  return { args: [...params] }
}

module.exports = {
  success,
  info,
  warn,
  error
}
