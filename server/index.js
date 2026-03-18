const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');
const path    = require('path');
const crypto  = require('crypto');
const db      = require('./db');
const { runMonitor, checkSite } = require('./monitor');
require('dotenv').config();

const app           = express();
const PORT          = process.env.PORT || 3001;
const CHECK_INTERVAL = process.env.CHECK_INTERVAL || '*/1 * * * *';

// ── 首次启动：写入默认安全配置 ──────────────────────────────
const ensureSettings = () => {
  if (!db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_user')) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('admin_user', 'admin');
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('admin_pass', crypto.randomBytes(4).toString('hex'));
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('access_path', crypto.randomBytes(8).toString('hex'));
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('reg_token',   crypto.randomBytes(16).toString('hex'));
  }
};
ensureSettings();

const getSetting = (key) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;

// ── Express 中间件 ────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── 静态前端文件（npm run build 产出的 dist） ─────────────
const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));

// ── 认证中间件 ────────────────────────────────────────────
const auth = (req, res, next) => {
  if (req.headers['authorization'] === getSetting('reg_token')) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// ── API ───────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { user, pass } = req.body;
  if (user === getSetting('admin_user') && pass === getSetting('admin_pass')) {
    res.json({ token: getSetting('reg_token') });
  } else {
    res.status(401).json({ error: '用户名或密码错误' });
  }
});

app.get('/api/config', auth, (req, res) => {
  res.json({
    admin_user:  getSetting('admin_user'),
    admin_pass:  getSetting('admin_pass'),
    reg_token:   getSetting('reg_token'),
    access_path: getSetting('access_path'),
    bark_key:    getSetting('bark_key'),
  });
});

app.get('/api/sites', auth, (req, res) => {
  res.json({ sites: db.prepare('SELECT * FROM sites ORDER BY last_checked DESC').all() });
});

app.post('/api/sites', auth, (req, res) => {
  const { url, name, interval } = req.body;
  try {
    const info = db.prepare('INSERT INTO sites (url, name, interval) VALUES (?, ?, ?)')
      .run(url, name || url, interval || 60);
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/sites/:id', auth, (req, res) => {
  db.prepare('DELETE FROM sites WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/check-now/:id', auth, async (req, res) => {
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!site) return res.status(404).json({ error: 'Not found' });
  if (site.status === 'checking') return res.status(400).json({ error: 'Busy' });
  await checkSite(site);
  res.json({ success: true });
});

app.get('/api/changes', auth, (req, res) => {
  res.json({
    changes: db.prepare(
      `SELECT changes.*, sites.name as site_name
       FROM changes JOIN sites ON changes.site_id = sites.id
       ORDER BY detected_at DESC LIMIT 50`
    ).all()
  });
});

app.post('/api/settings', auth, (req, res) => {
  const { bark_key } = req.body;
  if (bark_key) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('bark_key', bark_key);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'bark_key required' });
  }
});

// ── SPA 回退：所有非 API 请求都返回 index.html ────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ── 定时监控任务 ──────────────────────────────────────────
cron.schedule(CHECK_INTERVAL, () => runMonitor());

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NanoMonitor running → http://0.0.0.0:${PORT}`);
});
