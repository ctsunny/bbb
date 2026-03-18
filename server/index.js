const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');
const path    = require('path');
const crypto  = require('crypto');
const db      = require('./db');
const { runMonitor, checkSite, discoverProducts } = require('./monitor');
require('dotenv').config();

const VERSION = 'v1.6.0';
const app     = express();
const PORT    = process.env.PORT || 3001;

// ── Resilient DB Helpers ──────────────────────────────────────────
const safeRun = (sql, ...params) => {
  try { return db.prepare(sql).run(...params); }
  catch (e) { console.error(`[DB Run Err] ${sql}`, e.message); return null; }
};
const safeAll = (sql, ...params) => {
  try { return db.prepare(sql).all(...params); }
  catch (e) { console.error(`[DB All Err] ${sql}`, e.message); return []; }
};
const safeGet = (sql, ...params) => {
  try { return db.prepare(sql).get(...params); }
  catch (e) { console.error(`[DB Get Err] ${sql}`, e.message); return null; }
};

// ── Initial Setup ──────────────────────────────────────────────────────────
const ensureSettings = () => {
  if (!safeGet('SELECT value FROM settings WHERE key = ?', 'admin_user')) {
    safeRun('INSERT INTO settings (key,value) VALUES (?,?)', 'admin_user', 'admin');
    safeRun('INSERT INTO settings (key,value) VALUES (?,?)', 'admin_pass',  crypto.randomBytes(4).toString('hex'));
    safeRun('INSERT INTO settings (key,value) VALUES (?,?)', 'access_path', crypto.randomBytes(8).toString('hex'));
    safeRun('INSERT INTO settings (key,value) VALUES (?,?)', 'reg_token',   crypto.randomBytes(16).toString('hex'));
  }
};
ensureSettings();

const getSetting = (key) => safeGet('SELECT value FROM settings WHERE key = ?', key)?.value;

app.use(cors());
app.use(express.json());

// ── Auth Middleware ──────────────────────────────────────────────────────────
const auth = (req, res, next) => {
  const token = req.headers['authorization'] || req.headers['Authorization'];
  if (token === getSetting('reg_token')) return next();
  return res.status(401).json({ error: 'Unauthorized' });
};

// ── API Wrapper ──────────────────────────────────────────────────────────────
const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (e) { 
    console.error(`[API Error] ${req.method} ${req.path}`, e); 
    res.status(500).json({ error: e.message || 'Server Error' }); 
  }
};

// ── API Endpoints ────────────────────────────────────────────────────────────
app.post('/api/login', wrap((req, res) => {
  const { user, pass } = req.body;
  if (user === getSetting('admin_user') && pass === getSetting('admin_pass')) {
    return res.json({ token: getSetting('reg_token') });
  }
  res.status(401).json({ error: '用户名或密码错误' });
}));

app.get('/api/config', auth, wrap((req, res) => {
  res.json({
    admin_user:  getSetting('admin_user'),
    admin_pass:  getSetting('admin_pass'),
    reg_token:   getSetting('reg_token'),
    access_path: getSetting('access_path'),
    bark_key:    getSetting('bark_key'),
    version:     VERSION,
  });
}));

app.get('/api/sites', auth, wrap((req, res) => {
  const rows = safeAll("SELECT * FROM sites ORDER BY id DESC");
  const sites = rows.map(s => ({
    ...s,
    // Fix time format to ISO with Z for frontend
    last_checked: s.last_checked ? (s.last_checked.replace(' ', 'T') + (s.last_checked.endsWith('Z') ? '' : 'Z')) : null,
  }));
  res.json({ sites });
}));

app.post('/api/sites', auth, wrap((req, res) => {
  const { url, name, interval } = req.body;
  const existing = safeGet('SELECT id FROM sites WHERE url = ?', url);
  if (existing) {
    safeRun('UPDATE sites SET name = ?, interval = ?, is_active = 1 WHERE id = ?', 
      name || url, Number(interval) || 60, existing.id);
    return res.json({ id: existing.id, updated: true });
  }
  const info = db.prepare('INSERT INTO sites (url,name,interval) VALUES (?,?,?)')
    .run(url, name || url, Number(interval) || 60);
  res.json({ id: info.lastInsertRowid });
}));

app.patch('/api/sites/:id', auth, wrap((req, res) => {
  const { name, interval } = req.body;
  if (name !== undefined)     safeRun('UPDATE sites SET name = ? WHERE id = ?', name, req.params.id);
  if (interval !== undefined) safeRun('UPDATE sites SET interval = ? WHERE id = ?', Number(interval), req.params.id);
  res.json({ success: true });
}));

app.delete('/api/sites/:id', auth, wrap((req, res) => {
  const id = req.params.id;
  safeRun('DELETE FROM changes WHERE site_id = ?', id);
  const result = safeRun('DELETE FROM sites WHERE id = ?', id);
  res.json({ success: true, deleted: result?.changes });
}));

app.post('/api/check-now/:id', auth, wrap(async (req, res) => {
  const site = safeGet('SELECT * FROM sites WHERE id = ?', req.params.id);
  if (!site) return res.status(404).json({ error: 'Not found' });
  checkSite(site).catch(e => console.error('[checkNow Err]', e.message));
  res.json({ success: true });
}));

app.get('/api/snapshot/:id', auth, wrap((req, res) => {
  const site = safeGet('SELECT name, url, last_content, last_checked FROM sites WHERE id = ?', req.params.id);
  if (!site) return res.status(404).json({ error: 'Not found' });
  let lines = [];
  try { lines = JSON.parse(site.last_content || '[]'); } catch(e) {}
  res.json({ name: site.name, url: site.url, last_checked: site.last_checked, lines });
}));

app.get('/api/changes', auth, wrap((req, res) => {
  const changes = safeAll(
    `SELECT changes.id, changes.site_id, changes.diff_summary, changes.detected_at,
            COALESCE(sites.name, '已删除') as site_name, COALESCE(sites.url, '') as site_url
     FROM changes LEFT JOIN sites ON changes.site_id = sites.id
     ORDER BY changes.detected_at DESC LIMIT 300`
  );
  res.json({ changes });
}));

app.delete('/api/changes/:siteId', auth, wrap((req, res) => {
  const result = safeRun('DELETE FROM changes WHERE site_id = ?', req.params.siteId);
  res.json({ success: true, deleted: result?.changes });
}));

app.post('/api/settings', auth, wrap((req, res) => {
  const { bark_key } = req.body;
  safeRun('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)', 'bark_key', bark_key);
  res.json({ success: true });
}));

app.post('/api/discover', auth, wrap(async (req, res) => {
  const products = await discoverProducts(req.body.url);
  res.json({ products });
}));

// ── Robust Static File Serving ──────────────────────────────────────────────
const distPath = path.resolve(__dirname, '..', 'client', 'dist');

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const access = getSetting('access_path');
  const base   = `/console-${access}`;
  
  if (req.path === base) return res.redirect(base + '/');
  
  if (req.path.startsWith(base + '/')) {
    const originalUrl = req.url;
    // Strip base prefix for express.static
    req.url = req.url.substring(base.length);
    if (req.url === '' || req.url === '/') {
      req.url = '/index.html';
    }
    return express.static(distPath)(req, res, () => {
      // If not a static file, serve index.html (SPA)
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
  
  res.status(403).send('<h1>403 Forbidden</h1><p>NanoMonitor Access Protocol Required</p>');
});

cron.schedule('* * * * *', () => runMonitor());

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NanoMonitor v1.6.1 active at http://0.0.0.0:${PORT}`);
});
