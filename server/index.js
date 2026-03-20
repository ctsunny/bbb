const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');
const path    = require('path');
const crypto  = require('crypto');
const db      = require('./db');
const { runMonitor, checkSite, discoverProducts, closeBrowser } = require('./monitor');
require('dotenv').config();

const VERSION = 'v1.8.5';
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

// ── Rate Limiting Middleware (must be before routes) ─────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 分钟
const RATE_LIMIT_MAX = 30; // 最多 30 次请求

const rateLimit = (req, res, next) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, startTime: now });
    return next();
  }
  
  const record = rateLimitMap.get(ip);
  if (now - record.startTime > RATE_LIMIT_WINDOW) {
    record.count = 1;
    record.startTime = now;
    return next();
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
  }
  
  record.count++;
  next();
};

app.use('/api', rateLimit);

// ── Auth Middleware ──────────────────────────────────────────────────────────
const auth = (req, res, next) => {
  const token = req.headers['authorization'] || req.headers['Authorization'];
  if (token === getSetting('reg_token')) return next();
  return res.status(401).json({ error: 'Unauthorized' });
};

// ── SSRF Guard ───────────────────────────────────────────────────────────────
// Returns true when the URL is safe (public), false when it must be blocked.
const isPrivateHostname = (hostname) => {
  if (hostname === 'localhost') return true;
  // IPv4 private / loopback ranges
  const ipv4Re = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const m = hostname.match(ipv4Re);
  if (m) {
    const [, a, b] = m.map(Number);
    if (a === 127) return true;                    // 127.0.0.0/8
    if (a === 10) return true;                     // 10.0.0.0/8
    if (a === 192 && b === 168) return true;       // 192.168.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 169 && b === 254) return true;       // 169.254.0.0/16 link-local
    if (a === 0) return true;                      // 0.0.0.0/8
  }
  return false;
};

const validatePublicUrl = (url) => {
  let parsed;
  try { parsed = new URL(url); } catch { return '无效的 URL 格式'; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return '只支持 HTTP/HTTPS 协议';
  if (isPrivateHostname(parsed.hostname)) return '不允许访问内网地址';
  return null; // OK
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
    last_checked: s.last_checked ? (s.last_checked.replace(' ', 'T') + (s.last_checked.endsWith('Z') ? '' : 'Z')) : null,
  }));
  res.json({ sites });
}));

app.post('/api/sites', auth, wrap((req, res) => {
  const { url, name, interval } = req.body;
  
  const urlError = validatePublicUrl(url);
  if (urlError) return res.status(400).json({ error: urlError });
  
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
  // Ensure ISO format for frontend timeAgo
  const last_checked_iso = site.last_checked ? (site.last_checked.replace(' ', 'T') + (site.last_checked.endsWith('Z') ? '' : 'Z')) : null;
  res.json({ name: site.name, url: site.url, last_checked: last_checked_iso, lines });
}));

app.get('/api/changes', auth, wrap((req, res) => {
  const changes = safeAll(
    `SELECT changes.id, changes.site_id, changes.diff_summary, changes.detected_at,
            COALESCE(sites.name, '已删除') as site_name, COALESCE(sites.url, '') as site_url
     FROM changes LEFT JOIN sites ON changes.site_id = sites.id
     ORDER BY changes.detected_at DESC LIMIT 300`
  );
  // XSS 防护：转义 diff_summary 中的 HTML 特殊字符
  const escapeHtml = (text) => {
    if (!text) return text;
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
  const sanitizedChanges = changes.map(c => ({
    ...c,
    diff_summary: escapeHtml(c.diff_summary)
  }));
  res.json({ changes: sanitizedChanges });
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
  const { url } = req.body;
  
  const urlError = validatePublicUrl(url);
  if (urlError) return res.status(400).json({ error: urlError });
  
  const products = await discoverProducts(url);
  res.json({ products });
}));

// ── Robust Static File Serving ──────────────────────────────────────────────
const distPath = path.resolve(__dirname, '..', 'client', 'dist');

let cachedAccessPath = null;
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  if (!cachedAccessPath) cachedAccessPath = getSetting('access_path');
  const base   = `/console-${cachedAccessPath}`;
  
  if (req.path === base || req.path === base + '/') {
    // Force trailing slash logic
    if (req.path === base) return res.redirect(base + '/');
    
    // Serve index.html directly for the root of the console
    return res.sendFile(path.join(distPath, 'index.html'));
  }
  
  if (req.path.startsWith(base + '/')) {
    req.url = req.url.substring(base.length);
    if (req.url === '' || req.url === '/') {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    return express.static(distPath)(req, res, () => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
  res.status(403).send('<h1>403 Forbidden</h1><p>NanoMonitor Access Protocol Required (' + req.path + ' rejected)</p>');
});

cron.schedule('* * * * *', () => runMonitor());

// 优雅关闭：清理浏览器实例和数据库连接
const gracefulShutdown = async (signal) => {
  console.log(`\n收到 ${signal} 信号，正在优雅关闭...`);
  
  await closeBrowser();
  
  try {
    db.close();
    console.log('数据库连接已关闭');
  } catch (e) {
    console.error('关闭数据库时出错:', e.message);
  }
  
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

app.listen(PORT, '0.0.0.0', () => {
  const access = getSetting('access_path');
  console.log(`\n=================================================`);
  console.log(`🚀 NanoMonitor ${VERSION} 已就绪！`);
  console.log(`🔗 专用后台路径: http://您的服务器IP:${PORT}/console-${access}`);
  console.log(`🔑 登 录 账 号: admin`);
  console.log(`🔑 登 录 密 码: ${getSetting('admin_pass')}`);
  console.log(`=================================================\n`);
});
