#!/usr/bin/env node
const chalk = require('chalk')
const program = require('commander')

// Setup sub-commands
program
  .version(require('../package.json').version)
  .command('search', 'Search for award inventory.')
  .command('parse', 'Parse search results from database.')
  .command('import', 'Import search results from another directory.')
  .command('cleanup', 'Remove incomplete requests or data resources.')
  .command('stats', 'Print statistics on routes stored in the database.')
  .command('client', 'Launch the web client.')
  .command('server', 'Launch the web server.')
  .parse(process.argv)

// Banner
console.log(chalk.bold(`flightplan ${program.args[0]} ${program._version}`))
