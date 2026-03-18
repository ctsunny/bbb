const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'monitor.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize tables with optimizations
db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE NOT NULL,
    name TEXT,
    last_content TEXT,
    last_checked DATETIME,
    status TEXT DEFAULT 'idle', -- idle, checking, error
    error_message TEXT,
    interval INTEGER DEFAULT 60,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER,
    diff_summary TEXT,
    full_snapshot TEXT,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  -- Indexing for performance
  CREATE INDEX IF NOT EXISTS idx_changes_site_id ON changes(site_id);
  CREATE INDEX IF NOT EXISTS idx_sites_active ON sites(is_active);
`);

// Add missing columns for backward compatibility (sqlite throws if column already exists, that's OK)
// -- sites table migrations --
try { db.exec("ALTER TABLE sites ADD COLUMN status TEXT DEFAULT 'idle'"); } catch(e) {}
try { db.exec("ALTER TABLE sites ADD COLUMN error_message TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE sites ADD COLUMN interval INTEGER DEFAULT 60"); } catch(e) {}
try { db.exec("ALTER TABLE sites ADD COLUMN is_active INTEGER DEFAULT 1"); } catch(e) {}
// -- changes table migrations --
try { db.exec("ALTER TABLE changes ADD COLUMN diff_summary TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE changes ADD COLUMN full_snapshot TEXT"); } catch(e) {}

module.exports = db;
