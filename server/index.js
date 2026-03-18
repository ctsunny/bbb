const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const db = require('./db');
const { runMonitor, checkSite } = require('./monitor');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const CHECK_INTERVAL = process.env.CHECK_INTERVAL || '*/1 * * * *';

// Initial security setup
const ensureSettings = () => {
  const admin = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_user');
  if (!admin) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('admin_user', 'admin');
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('admin_pass', crypto.randomBytes(4).toString('hex'));
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('access_path', crypto.randomBytes(8).toString('hex'));
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('reg_token', crypto.randomBytes(16).toString('hex'));
  }
};
ensureSettings();

const getSetting = (key) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;

app.use(cors());
app.use(express.json());

// --- Authentication Middleware ---
const authMiddleware = (req, res, next) => {
  const token = req.headers['authorization'];
  const savedToken = getSetting('reg_token');
  if (token === savedToken) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// --- API Endpoints ---

// Public Auth Check
app.post('/api/login', (req, res) => {
  const { user, pass } = req.body;
  const adminUser = getSetting('admin_user');
  const adminPass = getSetting('admin_pass');
  const regToken = getSetting('reg_token');
  const accessPath = getSetting('access_path');

  if (user === adminUser && pass === adminPass) {
    res.json({ token: regToken, accessPath });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Protected Endpoints
app.get('/api/config', authMiddleware, (req, res) => {
  res.json({
    admin_user: getSetting('admin_user'),
    admin_pass: getSetting('admin_pass'),
    reg_token: getSetting('reg_token'),
    access_path: getSetting('access_path'),
    bark_key: getSetting('bark_key')
  });
});

app.get('/api/sites', authMiddleware, (req, res) => {
  const sites = db.prepare('SELECT * FROM sites ORDER BY last_checked DESC').all();
  res.json({ sites });
});

app.post('/api/sites', authMiddleware, (req, res) => {
  const { url, name, interval } = req.body;
  try {
    const info = db.prepare('INSERT INTO sites (url, name, interval) VALUES (?, ?, ?)')
      .run(url, name || url, interval || 60);
    res.json({ id: info.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/sites/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM sites WHERE id = ?').run(id);
  res.json({ success: true });
});

app.post('/api/check-now/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(id);
  if (site) {
    if (site.status === 'checking') return res.status(400).json({ error: 'Busy' });
    await checkSite(site);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.get('/api/changes', authMiddleware, (req, res) => {
  const changes = db.prepare('SELECT changes.*, sites.name as site_name FROM changes JOIN sites ON changes.site_id = sites.id ORDER BY detected_at DESC LIMIT 50').all();
  res.json({ changes });
});

app.post('/api/settings', authMiddleware, (req, res) => {
  const { bark_key } = req.body;
  if (bark_key) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      .run('bark_key', bark_key);
    res.json({ success: true });
  }
});

// Cron setup
cron.schedule(CHECK_INTERVAL, () => {
  runMonitor();
});

app.listen(PORT, () => {
  console.log(`BWPanel Backend running on http://localhost:${PORT}`);
});
