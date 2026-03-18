const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'monitor.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE NOT NULL,
    name TEXT,
    last_content TEXT,
    last_checked DATETIME,
    interval INTEGER DEFAULT 60, -- seconds
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER,
    diff TEXT,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(site_id) REFERENCES sites(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

module.exports = db;
