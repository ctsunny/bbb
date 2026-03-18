const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');
const path    = require('path');
const crypto  = require('crypto');
const db      = require('./db');
const { runMonitor, checkSite, discoverProducts } = require('./monitor');
require('dotenv').config();

const VERSION = 'v1.5.0';
const app     = express();
const PORT    = process.env.PORT || 3001;

// ── 初始化配置 ───────────────────────────────────────────────────────
const ensureSettings = () => {
  if (!db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_user')) {
    db.prepare('INSERT INTO settings (key,value) VALUES (?,?)').run('admin_user', 'admin');
    db.prepare('INSERT INTO settings (key,value) VALUES (?,?)').run('admin_pass',  crypto.randomBytes(4).toString('hex'));
    db.prepare('INSERT INTO settings (key,value) VALUES (?,?)').run('access_path', crypto.randomBytes(8).toString('hex'));
    db.prepare('INSERT INTO settings (key,value) VALUES (?,?)').run('reg_token',   crypto.randomBytes(16).toString('hex'));
  }
};
ensureSettings();

const getSetting = (key) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;

app.use(cors());
app.use(express.json());

// ── 认证中间件 ────────────────────────────────────────────────────────
const auth = (req, res, next) => {
  const token = req.headers['authorization'] || req.headers['Authorization'];
  if (token === getSetting('reg_token')) return next();
  return res.status(401).json({ error: 'Unauthorized' });
};

// ── 登录 ──────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { user, pass } = req.body;
  if (user === getSetting('admin_user') && pass === getSetting('admin_pass')) {
    return res.json({ token: getSetting('reg_token') });
  }
  res.status(401).json({ error: '用户名或密码错误' });
});

// ── 配置 ──────────────────────────────────────────────────────────────
app.get('/api/config', auth, (req, res) => {
  res.json({
    admin_user:  getSetting('admin_user'),
    admin_pass:  getSetting('admin_pass'),
    reg_token:   getSetting('reg_token'),
    access_path: getSetting('access_path'),
    bark_key:    getSetting('bark_key'),
    version:     VERSION,
  });
});

// ── 站点列表 ──────────────────────────────────────────────────────────
app.get('/api/sites', auth, (req, res) => {
  // 返回 UTC 时间带 Z 后缀，前端可正确解析
  const sites = db.prepare("SELECT *, datetime(last_checked,'utc') as last_checked_utc FROM sites ORDER BY created_at DESC").all()
    .map(s => ({ ...s, last_checked: s.last_checked_utc ? s.last_checked_utc + 'Z' : null }));
  res.json({ sites });
});

// ── 新增站点 ──────────────────────────────────────────────────────────
app.post('/api/sites', auth, (req, res) => {
  const { url, name, interval } = req.body;
  try {
    const info = db.prepare('INSERT INTO sites (url,name,interval) VALUES (?,?,?)')
      .run(url, name || url, Number(interval) || 60);
    res.json({ id: info.lastInsertRowid });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 更新站点配置（名称/间隔）──────────────────────────────────────────
app.patch('/api/sites/:id', auth, (req, res) => {
  const { name, interval } = req.body;
  try {
    if (name !== undefined)     db.prepare('UPDATE sites SET name     = ? WHERE id = ?').run(name,            req.params.id);
    if (interval !== undefined) db.prepare('UPDATE sites SET interval = ? WHERE id = ?').run(Number(interval), req.params.id);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 删除站点（先删子记录，防止旧库无CASCADE）────────────────────────
app.delete('/api/sites/:id', auth, (req, res) => {
  try {
    const id = req.params.id;
    db.prepare('DELETE FROM changes WHERE site_id = ?').run(id);
    db.prepare('DELETE FROM sites   WHERE id = ?').run(id);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 立即检查 ──────────────────────────────────────────────────────────
app.post('/api/check-now/:id', auth, async (req, res) => {
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!site)                   return res.status(404).json({ error: 'Not found' });
  if (site.status==='checking') return res.status(400).json({ error: 'Already checking' });
  checkSite(site).catch(e => console.error('[check-now]', e.message));
  res.json({ success: true, message: '检查已触发，请稍后刷新' });
});

// ── 获取快照 ──────────────────────────────────────────────────────────
app.get('/api/snapshot/:id', auth, (req, res) => {
  const site = db.prepare('SELECT name, url, last_content, last_checked FROM sites WHERE id = ?').get(req.params.id);
  if (!site) return res.status(404).json({ error: 'Not found' });
  let lines = [];
  try { lines = JSON.parse(site.last_content || '[]'); } catch(e) {}
  res.json({ name: site.name, url: site.url, last_checked: site.last_checked, lines });
});

// ── 变动历史 ──────────────────────────────────────────────────────────
app.get('/api/changes', auth, (req, res) => {
  const changes = db.prepare(
    `SELECT changes.id, changes.site_id, changes.diff_summary,
            datetime(changes.detected_at,'utc') || 'Z' as detected_at,
            sites.name as site_name, sites.url as site_url
     FROM changes JOIN sites ON changes.site_id = sites.id
     ORDER BY detected_at DESC LIMIT 300`
  ).all();
  res.json({ changes });
});

// ── 清除某站点历史 ────────────────────────────────────────────────────
app.delete('/api/changes/:siteId', auth, (req, res) => {
  try {
    db.prepare('DELETE FROM changes WHERE site_id = ?').run(req.params.siteId);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 设置 ──────────────────────────────────────────────────────────────
app.post('/api/settings', auth, (req, res) => {
  const { bark_key } = req.body;
  if (bark_key === undefined) return res.status(400).json({ error: 'bark_key required' });
  db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run('bark_key', bark_key);
  res.json({ success: true });
});

// ── 商品发现 ──────────────────────────────────────────────────────────
app.post('/api/discover', auth, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  try {
    const products = await discoverProducts(url);
    res.json({ products });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 前端静态文件服务（动态隐藏路径）────────────────────────────────────
const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const access = getSetting('access_path');
  const base   = `/console-${access}`;
  if (req.path === base)               return res.redirect(base + '/');
  if (req.path.startsWith(base + '/')) {
    req.url = req.url.replace(base, '');
    return express.static(distPath)(req, res, () => res.sendFile(path.join(distPath, 'index.html')));
  }
  res.status(403).send('<h1>403 Forbidden</h1>');
});

// ── 定时监控：每分钟检查一次，内部按各站点 interval 决定是否触发 ────
cron.schedule('* * * * *', () => runMonitor());

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NanoMonitor ${VERSION} → http://0.0.0.0:${PORT}`);
});
