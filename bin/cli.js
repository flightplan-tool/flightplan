// Setup sub-commands
require('commander')
  .version(require('../package.json').version)
  .command('search', 'Search for award inventory.')
  .command('parse', 'Parse search results from database.')
  .command('import', 'Import search results from another directory.')
  .command('server', 'Launch the web server.')
  .parse(process.argv)
