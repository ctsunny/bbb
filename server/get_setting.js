#!/usr/bin/env node
// 工具脚本: 从数据库读取配置项，替代 sqlite3 命令行工具
// 用法: node get_setting.js <key>

const key = process.argv[2];
if (!key) process.exit(1);

const path = require('path');
const dbPath = path.join(__dirname, 'monitor.db');

try {
  const Database = require('better-sqlite3');
  const db = new Database(dbPath, { readonly: true });
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (row) process.stdout.write(row.value);
} catch (e) {
  process.exit(1);
}
