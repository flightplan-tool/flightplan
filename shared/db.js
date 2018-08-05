const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')

const paths = require('./paths')

let _db = null

function db () {
  return _db
}

function open () {
  if (!_db) {
    _db = new Database(paths.database)
  }
  return _db
}

function migrate () {
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
    _db = open()
    createTable('requests', [
      'id INTEGER PRIMARY KEY ASC',
      'engine TEXT NOT NULL',
      'partners BOOLEAN NOT NULL',
      'fromCity TEXT NOT NULL',
      'toCity TEXT NOT NULL',
      'departDate TEXT NOT NULL',
      'returnDate TEXT',
      'cabin TEXT',
      'quantity INTEGER DEFAULT 0',
      'assets TEXT NOT NULL',
      'updatedAt TEXT DEFAULT CURRENT_TIMESTAMP'
    ])
    createTable('awards', [
      'id INTEGER PRIMARY KEY ASC',
      'requestId INTEGER',
      'engine TEXT NOT NULL',
      'partner BOOLEAN NOT NULL',
      'fromCity TEXT NOT NULL',
      'toCity TEXT NOT NULL',
      'date TEXT NOT NULL',
      'departure TEXT',
      'arrival TEXT',
      'cabin TEXT NOT NULL',
      'mixed BOOLEAN NOT NULL',
      'duration TEXT',
      'stops INTEGER DEFAULT 0',
      'quantity INTEGER DEFAULT 1',
      'mileage INTEGER',
      'fees INTEGER',
      'fares TEXT',
      'updated_at TEXT DEFAULT CURRENT_TIMESTAMP'
    ])
    createTable('segments', [
      'id INTEGER PRIMARY KEY ASC',
      'awardId INTEGER',
      'position INTEGER NOT NULL',
      'airline TEXT NOT NULL',
      'flight TEXT NOT NULL',
      'aircraft TEXT',
      'fromCity TEXT NOT NULL',
      'toCity TEXT NOT NULL',
      'date TEXT NOT NULL',
      'departure TEXT NOT NULL',
      'arrival TEXT NOT NULL',
      'duration TEXT',
      'connectionTime TEXT',
      'cabin TEXT NOT NULL',
      'stops INTEGER DEFAULT 0',
      'lagDays INTEGER DEFAULT 0',
      'bookingCode TEXT',
      'updated_at TEXT DEFAULT CURRENT_TIMESTAMP'
    ])
  } catch (err) {
    throw new Error(`Database migration failed: ${err.message}`)
  }
}

function createTable (tableName, columns) {
  return _db.prepare(`CREATE TABLE ${tableName} (${columns.join(',')})`).run()
}

function insertRow (table, row) {
  const entries = Object.entries(row)
  const colNames = entries.map(x => x[0])
  const colVals = entries.map(x => coerceType(x[1]))
  const sql = `INSERT INTO ${table} (${colNames.join(',')}) VALUES (${colVals.map(x => '?').join(',')})`
  return _db.prepare(sql).run(...colVals)
}

function coerceType (val) {
  switch (typeof val) {
    case 'boolean':
      return val ? 1 : 0
    case 'object':
      if (val !== null && val.constructor) {
        switch (val.constructor.name) {
          case 'Moment':
            return val.format('YYYY-MM-DD HH:mm:ss')
          case 'Duration':
            return val.toISOString()
          default:
            return val
        }
      }
      return val
  }
  return val
}

function count (table) {
  const result = _db.prepare(`SELECT count(*) FROM ${table}`).get()
  return result ? result['count(*)'] : undefined
}

function close () {
  if (_db) {
    _db.close()
    _db = null
  }
}

function begin () {
  _db.prepare('BEGIN').run()
}

function commit () {
  _db.prepare('COMMIT').run()
}

function rollback () {
  _db.prepare('ROLLBACK').run()
}

module.exports = {
  db,
  open,
  migrate,
  createTable,
  insertRow,
  coerceType,
  count,
  close,
  begin,
  commit,
  rollback
}
