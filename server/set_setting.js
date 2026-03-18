#!/usr/bin/env node
// 工具脚本: 写入/更新数据库配置项，替代 sqlite3 命令行工具
// 用法: node set_setting.js <key> <value>

const key   = process.argv[2];
const value = process.argv[3];
if (!key || value === undefined) process.exit(1);

const path = require('path');
const dbPath = path.join(__dirname, 'monitor.db');

try {
  const Database = require('better-sqlite3');
  const db = new Database(dbPath);
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
} catch (e) {
  console.error('写入失败:', e.message);
  process.exit(1);
}
