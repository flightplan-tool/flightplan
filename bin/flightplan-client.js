const shell = require('shelljs')

shell.exec(`yarn --cwd "${__dirname}" run client`)
