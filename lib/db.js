const fs = require('fs')
const path = require('path')
const sqlite = require('sqlite')
const consts = require('./consts')

async function migrate () {
  if (fs.existsSync(consts.DB_PATH)) {
    return
  }
  console.log('Creating database...')

  // Create database directory if missing
  const dir = path.dirname(consts.DB_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir)
  }

  // Create the database, and tables
  try {
    const db = await sqlite.open(consts.DB_PATH, { Promise })
    await createTable(db, 'awards_requests', [
      'id INTEGER PRIMARY KEY ASC',
      'engine TEXT NOT NULL',
      'fromCity TEXT NOT NULL',
      'toCity TEXT NOT NULL',
      'departDate TEXT NOT NULL',
      'returnDate TEXT',
      'cabinClass TEXT',
      'adults INTEGER DEFAULT 0',
      'children INTEGER DEFAULT 0',
      'htmlFile TEXT NOT NULL',
      'updatedAt TEXT DEFAULT CURRENT_TIMESTAMP'
    ])
    await createTable(db, 'awards', [
      'id INTEGER PRIMARY KEY ASC',
      'fromCity TEXT NOT NULL',
      'toCity TEXT NOT NULL',
      'date TEXT NOT NULL',
      'cabinClass TEXT NOT NULL',
      'flight TEXT NOT NULL',
      'aircraft TEXT',
      'fareCodes TEXT',
      'quantity INTEGER DEFAULT 0',
      'updated_at TEXT DEFAULT CURRENT_TIMESTAMP'
    ])
    await createTable(db, 'cookies', [
      'id INTEGER PRIMARY KEY ASC',
      'name TEXT NOT NULL',
      'domain TEXT NOT NULL',
      'path TEXT NOT NULL',
      'value TEXT NOT NULL',
      'updatedAt TEXT DEFAULT CURRENT_TIMESTAMP'
    ])
    await db.close()
  } catch (e) {
    throw new Error('Database migration failed')
  }
}

function createTable (db, tableName, columns) {
  return db.run(`CREATE TABLE ${tableName} (${columns.join(',')})`)
}

function insertRow (db, table, row, filter) {
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
  return db.run(sql, ...colVals)
}

async function loadCookies (db) {
  return (await db.all('select * from cookies')).map(x => JSON.parse(x.value))
}

async function saveCookies (db, cookies) {
  // cookies = cookies.filter(x => !x.session)
  for (const cookie of cookies) {
    const { name, domain, path } = cookie
    await db.run('INSERT OR REPLACE INTO cookies (id, name, domain, path, value) VALUES ' +
      '((SELECT id FROM cookies WHERE name = ? AND domain = ? AND path = ?), ?, ?, ?, ?)',
      name, domain, path, name, domain, path, JSON.stringify(cookie))
  }
}

module.exports = {
  migrate,
  createTable,
  insertRow,
  loadCookies,
  saveCookies
}
