const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf')

const paths = require('./paths')
const prompts = require('../shared/prompts')

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

function detectOldVersion () {
  let db = null
  try {
    db = new Database(paths.database)
    return !!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='awards_requests'`).get()
  } finally {
    if (db) {
      db.close()
    }
  }
}

function migrate () {
  if (fs.existsSync(paths.database)) {
    let migrationNeeded = false
    if (detectOldVersion()) {
      if (prompts.askYesNo(`
ERROR: An older version database was detected, that is incompatible with this version of Flightplan.

Would you like to convert it to the newer format? (WARNING: All search and award data will be deleted!)`)) {
        fs.unlinkSync(paths.database)
        rimraf.sync(paths.data)
        migrationNeeded = true
      }
    }
    if (!migrationNeeded) {
      return
    }
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
      'cabin TEXT NOT NULL',
      'mixed BOOLEAN NOT NULL',
      'duration INTEGER',
      'stops INTEGER DEFAULT 0',
      'quantity INTEGER DEFAULT 1',
      'mileage INTEGER',
      'fees TEXT',
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
      'duration INTEGER',
      'nextConnection INTEGER',
      'cabin TEXT',
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
  if (typeof val === 'boolean') {
    return val ? 1 : 0
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
