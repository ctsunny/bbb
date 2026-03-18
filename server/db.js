const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'monitor.db');
const db = new Database(dbPath);

// ── WAL mode + 启用外键约束（SQLite默认关闭，必须显式开启）──────────
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── 建表 ─────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    url          TEXT UNIQUE NOT NULL,
    name         TEXT,
    last_content TEXT,
    last_checked DATETIME,
    status       TEXT    DEFAULT 'idle',
    error_message TEXT,
    interval     INTEGER DEFAULT 60,
    is_active    INTEGER DEFAULT 1,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS changes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id      INTEGER,
    diff_summary TEXT,
    detected_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_changes_site_id ON changes(site_id);
  CREATE INDEX IF NOT EXISTS idx_sites_active    ON sites(is_active);
`);

// ── 旧版数据库迁移（字段不存在时自动添加，已存在则静默忽略）───────────
const migrate = (sql) => { try { db.exec(sql); } catch(e) {} };
migrate("ALTER TABLE sites   ADD COLUMN status        TEXT    DEFAULT 'idle'");
migrate("ALTER TABLE sites   ADD COLUMN error_message TEXT");
migrate("ALTER TABLE sites   ADD COLUMN interval      INTEGER DEFAULT 60");
migrate("ALTER TABLE sites   ADD COLUMN is_active     INTEGER DEFAULT 1");
migrate("ALTER TABLE changes ADD COLUMN diff_summary  TEXT");
// 旧版有 full_snapshot 列但我们已不再需要大快照，保留字段避免报错
migrate("ALTER TABLE changes ADD COLUMN full_snapshot TEXT");

module.exports = db;
