const chalk = require('chalk')

function success () {
  const { context, arguments: args } = opts(arguments)
  console.log(...(context ? [chalk.black(chalk.bgGreen(context))] : []), chalk.green('success'), ...args)
}

function info () {
  const { context, arguments: args } = opts(arguments)
  console.log(...(context ? [chalk.black(chalk.bgBlue(context))] : []), chalk.blue('info'), ...args)
}

function warn () {
  const { context, arguments: args } = opts(arguments)
  console.log(...(context ? [chalk.black(chalk.bgYellow(context))] : []), chalk.yellow('warning'), ...args)
}

function error () {
  const { context, arguments: args } = opts(arguments)
  console.log(...(context ? [chalk.black(chalk.bgRed(context))] : []), chalk.red('error'), ...args)
}

function opts (args) {
  const options = (args.length === 1 && typeof args[0] === 'object') ? args[0] : { arguments: args }
  options.arguments = [...options.arguments]
  return options
}

module.exports = {
  success,
  info,
  warn,
  error
}
