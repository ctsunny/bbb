const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');
const path    = require('path');
const crypto  = require('crypto');
const db      = require('./db');
const { runMonitor, checkSite, discoverProducts } = require('./monitor');
require('dotenv').config();

const VERSION = 'v1.5.3';
const app     = express();
const PORT    = process.env.PORT || 3001;

// ── 安全执行 DB 操作的辅助函数 ──────────────────────────────────────────
const safeRun = (sql, ...params) => {
  try { return db.prepare(sql).run(...params); }
  catch (e) { console.error(`[DB] ${sql}`, e.message); return null; }
};
const safeAll = (sql, ...params) => {
  try { return db.prepare(sql).all(...params); }
  catch (e) { console.error(`[DB] ${sql}`, e.message); return []; }
};
const safeGet = (sql, ...params) => {
  try { return db.prepare(sql).get(...params); }
  catch (e) { console.error(`[DB] ${sql}`, e.message); return null; }
};

// ── 初始化配置 ──────────────────────────────────────────────────────────
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

// ── 认证中间件 ──────────────────────────────────────────────────────────
const auth = (req, res, next) => {
  const token = req.headers['authorization'] || req.headers['Authorization'];
  if (token === getSetting('reg_token')) return next();
  return res.status(401).json({ error: 'Unauthorized' });
};

// ── API 包装器：统一 try-catch + 错误返回 ───────────────────────────────
const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (e) { console.error(`[API] ${req.method} ${req.path}`, e); res.status(500).json({ error: e.message || String(e) }); }
};

// ── 登录 ────────────────────────────────────────────────────────────────
app.post('/api/login', wrap((req, res) => {
  const { user, pass } = req.body;
  if (user === getSetting('admin_user') && pass === getSetting('admin_pass')) {
    return res.json({ token: getSetting('reg_token') });
  }
  res.status(401).json({ error: '用户名或密码错误' });
}));

// ── 配置 ────────────────────────────────────────────────────────────────
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

// ── 站点列表 ────────────────────────────────────────────────────────────
app.get('/api/sites', auth, wrap((req, res) => {
  const sites = safeAll("SELECT * FROM sites ORDER BY id DESC")
    .map(s => ({
      ...s,
      // 确保前端拿到 ISO 格式时间
      last_checked: s.last_checked ? s.last_checked.replace(' ', 'T') + (s.last_checked.endsWith('Z') ? '' : 'Z') : null,
    }));
  console.log(`[API] sites returned: ${sites.length}`);
  res.json({ sites });
}));

// ── 新增站点（URL 已存在则更新名称和间隔） ─────────────────────────────
app.post('/api/sites', auth, wrap((req, res) => {
  const { url, name, interval } = req.body;
  const existing = db.prepare('SELECT id FROM sites WHERE url = ?').get(url);
  if (existing) {
    db.prepare('UPDATE sites SET name = ?, interval = ?, is_active = 1 WHERE id = ?')
      .run(name || url, Number(interval) || 60, existing.id);
    return res.json({ id: existing.id, updated: true });
  }
  const info = db.prepare('INSERT INTO sites (url,name,interval) VALUES (?,?,?)')
    .run(url, name || url, Number(interval) || 60);
  res.json({ id: info.lastInsertRowid });
}));

// ── 更新站点配置 ────────────────────────────────────────────────────────
app.patch('/api/sites/:id', auth, wrap((req, res) => {
  const { name, interval } = req.body;
  if (name !== undefined)     db.prepare('UPDATE sites SET name = ? WHERE id = ?').run(name, req.params.id);
  if (interval !== undefined) db.prepare('UPDATE sites SET interval = ? WHERE id = ?').run(Number(interval), req.params.id);
  res.json({ success: true });
}));

// ── 删除站点 ────────────────────────────────────────────────────────────
app.delete('/api/sites/:id', auth, wrap((req, res) => {
  const id = Number(req.params.id);
  // 先安全删除子记录
  safeRun('DELETE FROM changes WHERE site_id = ?', id);
  // 再删除主记录
  const result = db.prepare('DELETE FROM sites WHERE id = ?').run(id);
  res.json({ success: true, deleted: result.changes });
}));

// ── 立即检查 ────────────────────────────────────────────────────────────
app.post('/api/check-now/:id', auth, wrap(async (req, res) => {
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(Number(req.params.id));
  if (!site)                    return res.status(404).json({ error: 'Not found' });
  if (site.status === 'checking') return res.status(400).json({ error: 'Already checking' });
  checkSite(site).catch(e => console.error('[check-now]', e.message));
  res.json({ success: true, message: '检查已触发' });
}));

// ── 查看快照 ────────────────────────────────────────────────────────────
app.get('/api/snapshot/:id', auth, wrap((req, res) => {
  const site = db.prepare('SELECT name, url, last_content, last_checked FROM sites WHERE id = ?').get(Number(req.params.id));
  if (!site) return res.status(404).json({ error: 'Not found' });
  let lines = [];
  try { lines = JSON.parse(site.last_content || '[]'); } catch(e) {}
  res.json({ name: site.name, url: site.url, last_checked: site.last_checked, lines });
}));

// ── 变动历史 ────────────────────────────────────────────────────────────
app.get('/api/changes', auth, wrap((req, res) => {
  // 用 LEFT JOIN 以防孤立记录
  const changes = safeAll(
    `SELECT changes.id, changes.site_id, changes.diff_summary,
            changes.detected_at,
            COALESCE(sites.name, '已删除') as site_name,
            COALESCE(sites.url, '') as site_url
     FROM changes LEFT JOIN sites ON changes.site_id = sites.id
     ORDER BY changes.detected_at DESC LIMIT 300`
  );
  res.json({ changes });
}));

// ── 清除某站点的变动历史 ────────────────────────────────────────────────
app.delete('/api/changes/:siteId', auth, wrap((req, res) => {
  const siteId = Number(req.params.siteId);
  const result = db.prepare('DELETE FROM changes WHERE site_id = ?').run(siteId);
  res.json({ success: true, deleted: result.changes });
}));

// ── 设置 ────────────────────────────────────────────────────────────────
app.post('/api/settings', auth, wrap((req, res) => {
  const { bark_key } = req.body;
  if (bark_key === undefined) return res.status(400).json({ error: 'bark_key required' });
  db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run('bark_key', bark_key);
  res.json({ success: true });
}));

// ── 商品发现 ────────────────────────────────────────────────────────────
app.post('/api/discover', auth, wrap(async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  const products = await discoverProducts(url);
  res.json({ products });
}));

// ── 全局错误处理中间件（兜底） ──────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Global Error]', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// ── 前端静态文件 ────────────────────────────────────────────────────────
const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const access = getSetting('access_path');
  const base   = `/console-${access}`;
  if (req.path === base) return res.redirect(base + '/');
  if (req.path.startsWith(base + '/')) {
    req.url = req.url.replace(base, '');
    return express.static(distPath)(req, res, () => res.sendFile(path.join(distPath, 'index.html')));
  }
  res.status(403).send('<h1>403 Forbidden</h1>');
});

// ── 定时监控 ────────────────────────────────────────────────────────────
cron.schedule('* * * * *', () => runMonitor());

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NanoMonitor ${VERSION} → http://0.0.0.0:${PORT}`);
});
