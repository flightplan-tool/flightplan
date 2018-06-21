const fs = require('fs')
const path = require('path')
const sqlite = require('sqlite')

const paths = require('./paths')

let _db = null

function db () {
  return _db
}

async function open () {
  if (!_db) {
    _db = await sqlite.open(paths.database, { Promise })
  }
  return _db
}

async function migrate () {
  if (fs.existsSync(paths.database)) {
    return
  }
  console.log('Creating database...')

  // Create database directory if missing
  const dir = path.dirname(paths.database)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir)
  }

  // Create the database, and tables
  try {
    _db = await open()
    await createTable('awards_requests', [
      'id INTEGER PRIMARY KEY ASC',
      'engine TEXT NOT NULL',
      'fromCity TEXT NOT NULL',
      'toCity TEXT NOT NULL',
      'departDate TEXT NOT NULL',
      'returnDate TEXT',
      'cabin TEXT',
      'quantity INTEGER DEFAULT 0',
      'htmlFile TEXT NOT NULL',
      'fileCount INTEGER DEFAULT 1',
      'updatedAt TEXT DEFAULT CURRENT_TIMESTAMP'
    ])
    await createTable('awards', [
      'id INTEGER PRIMARY KEY ASC',
      'engine TEXT NOT NULL',
      'fromCity TEXT NOT NULL',
      'toCity TEXT NOT NULL',
      'date TEXT NOT NULL',
      'cabin TEXT NOT NULL',
      'quantity INTEGER DEFAULT 0',
      'airline TEXT',
      'flight TEXT',
      'aircraft TEXT',
      'fares TEXT',
      'updated_at TEXT DEFAULT CURRENT_TIMESTAMP'
    ])
    await createTable('cookies', [
      'id INTEGER PRIMARY KEY ASC',
      'name TEXT NOT NULL',
      'domain TEXT NOT NULL',
      'path TEXT NOT NULL',
      'value TEXT NOT NULL',
      'updatedAt TEXT DEFAULT CURRENT_TIMESTAMP'
    ])
  } catch (e) {
    throw new Error('Database migration failed')
  }
}

function createTable (tableName, columns) {
  return _db.run(`CREATE TABLE ${tableName} (${columns.join(',')})`)
}

async function loadCookies () {
  return (await _db.all('select * from cookies')).map(x => JSON.parse(x.value))
}

async function saveCookies (cookies) {
  // cookies = cookies.filter(x => !x.session)
  for (const cookie of cookies) {
    const { name, domain, path } = cookie
    await _db.run('INSERT OR REPLACE INTO cookies (id, name, domain, path, value) VALUES ' +
      '((SELECT id FROM cookies WHERE name = ? AND domain = ? AND path = ?), ?, ?, ?, ?)',
      name, domain, path, name, domain, path, JSON.stringify(cookie))
  }
}

function insertRow (table, row, filter) {
  if (filter) {
    row = Object.keys(row).filter(key => filter.includes(key))
      .reduce((obj, key) => {
        obj[key] = row[key]
        return obj
      }, {})
  }
  const entries = Object.entries(row)
  const colNames = entries.map(x => x[0])
  const colVals = entries.map(x => x[1])
  const sql = `INSERT INTO ${table} (${colNames.join(',')}) VALUES (${colVals.map(x => '?').join(',')})`
  return _db.run(sql, ...colVals)
}

async function count (table) {
  const result = await _db.get(`SELECT count(*) FROM ${table}`)
  return result ? result['count(*)'] : undefined
}

async function close () {
  if (_db) {
    await _db.close()
    _db = null
  }
}

module.exports = {
  db,
  open,
  migrate,
  createTable,
  loadCookies,
  saveCookies,
  insertRow,
  count,
  close
}
