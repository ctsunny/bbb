import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';

const API_BASE = '/api';
const VERSION  = 'v1.8.5';

const timeAgo = (dt) => {
  if (!dt) return '从未';
  try {
    const d = new Date(dt);
    if (isNaN(d.getTime())) return '未知';
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 0)   return '刚刚';
    if (s < 60)  return `${s} 秒前`;
    if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
    if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
    return `${Math.floor(s / 86400)} 天前`;
  } catch { return '???'; }
};

const api = axios.create({ baseURL: API_BASE });

// ── Toast notification hook ───────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);
  return { toasts, toast };
}

// ── Confirm dialog hook ───────────────────────────────────────────────────────
function useConfirm() {
  const [dialog, setDialog] = useState(null);
  const confirm = useCallback((message) => new Promise(resolve => {
    setDialog({ message, resolve });
  }), []);
  const handleClose = (result) => {
    if (dialog) dialog.resolve(result);
    setDialog(null);
  };
  return { dialog, confirm, handleClose };
}

function ConfirmDialog({ dialog, onClose }) {
  if (!dialog) return null;
  return (
    <div className="confirm-overlay" onClick={() => onClose(false)}>
      <div className="confirm-card" onClick={e => e.stopPropagation()}>
        <div className="confirm-msg">{dialog.message}</div>
        <div className="confirm-actions">
          <button className="btn-secondary" onClick={() => onClose(false)}>取消</button>
          <button className="btn-danger" onClick={() => onClose(true)}>确认</button>
        </div>
      </div>
    </div>
  );
}

function ToastList({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
      ))}
    </div>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken]           = useState(null);
  const [loginForm, setLoginForm]   = useState({ user: '', pass: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [sites,    setSites]        = useState([]);
  const [changes,  setChanges]      = useState([]);
  const [barkKey,  setBarkKey]      = useState('');
  const [newSite,  setNewSite]      = useState({ url: '', name: '', interval: 60 });
  const [loading,  setLoading]      = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoveredItems, setDiscoveredItems] = useState([]);
  const [checking, setChecking]     = useState(null);
  const [expandedSite, setExpandedSite] = useState(null);
  const [snapshot, setSnapshot]     = useState(null);
  const [editInterval, setEditInterval] = useState({});
  const { toasts, toast } = useToast();
  const { dialog, confirm, handleClose } = useConfirm();

  // ── Auth Logic ──────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem('access_token');
    if (stored) {
      api.defaults.headers.common['Authorization'] = stored;
      api.get('/sites')
        .then(() => { setToken(stored); setIsLoggedIn(true); fetchData(); })
        .catch(() => { localStorage.removeItem('access_token'); setIsLoggedIn(false); });
    }
  }, []);

  useEffect(() => {
    const i = api.interceptors.response.use(r => r, err => {
      if (err.response?.status === 401) {
        localStorage.removeItem('access_token');
        setToken(null); setIsLoggedIn(false);
      }
      return Promise.reject(err);
    });
    return () => api.interceptors.response.eject(i);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [sRes, cRes, cfgRes] = await Promise.all([
        api.get('/sites'), api.get('/changes'), api.get('/config')
      ]);
      setSites(sRes.data?.sites || []);
      setChanges(cRes.data?.changes || []);
      setBarkKey(cfgRes.data?.bark_key || '');
    } catch(e) { console.error('Fetch Error:', e); }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchData();
      const t = setInterval(fetchData, 12000);
      return () => clearInterval(t);
    }
  }, [isLoggedIn, fetchData]);

  // ── Memoized Groups ───────────────────────────────────────
  const groups = useMemo(() => {
    if (!Array.isArray(changes)) return {};
    return changes.reduce((acc, c) => {
      if (!c.site_id) return acc;
      if (!acc[c.site_id]) {
        acc[c.site_id] = { name: c.site_name || '未知站点', url: c.site_url || '', items: [] };
      }
      acc[c.site_id].items.push(c);
      return acc;
    }, {});
  }, [changes]);

  // ── Actions ───────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await api.post('/login', loginForm);
      const tk = res.data.token;
      api.defaults.headers.common['Authorization'] = tk;
      localStorage.setItem('access_token', tk);
      setToken(tk); setIsLoggedIn(true);
      fetchData();
    } catch {
      setLoginError('用户名或密码错误，请重试');
    }
    setLoginLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    setToken(null); setIsLoggedIn(false);
  };

  const addSite = async (e) => {
    e.preventDefault(); 
    if (!newSite.url) return;
    setLoading(true);
    try {
      await api.post('/sites', newSite);
      setNewSite({ url: '', name: '', interval: 60 });
      setDiscoveredItems([]);
      toast('✅ 监控目标已同步', 'success');
      fetchData();
    } catch (err) { toast(err.response?.data?.error || '添加失败', 'error'); }
    setLoading(false);
  };

  const scanPage = async () => {
    if (!newSite.url) return toast('请输入目标网址', 'error');
    setDiscovering(true);
    try {
      const res = await api.post('/discover', { url: newSite.url });
      setDiscoveredItems(res.data.products || []);
      toast(res.data.products?.length > 0 ? `✨ 发现 ${res.data.products.length} 个目标` : '⚠️ 未发现商品', 'info');
    } catch (err) { toast('扫描失败：' + (err.response?.data?.error || err.message), 'error'); }
    setDiscovering(false);
  };

  const deleteSite = async (id) => {
    const ok = await confirm('确认物理删除该站点及历史？');
    if (!ok) return;
    try { await api.delete(`/sites/${id}`); toast('🗑️ 已移除', 'info'); fetchData(); }
    catch { toast('操作失败', 'error'); }
  };

  const checkNow = async (id) => {
    setChecking(id);
    try { await api.post(`/check-now/${id}`); toast('⚡ 检查指令已下达', 'success'); }
    catch { toast('触发失败', 'error'); }
    setTimeout(fetchData, 2000);
    setChecking(null);
  };

  const viewSnapshot = async (id) => {
    try {
      const res = await api.get(`/snapshot/${id}`);
      setSnapshot(res.data);
    } catch { toast('获取快照失败', 'error'); }
  };

  const updateInterval = async (siteId) => {
    const val = editInterval[siteId];
    if (!val || isNaN(val) || Number(val) < 10) return toast('间隔不能少于 10 秒', 'error');
    try {
      await api.patch(`/sites/${siteId}`, { interval: Number(val) });
      toast('✅ 频率已调整', 'success');
      setEditInterval(prev => { const n = {...prev}; delete n[siteId]; return n; });
      fetchData();
    } catch { toast('更新失败', 'error'); }
  };

  const cancelEditInterval = (siteId) => {
    setEditInterval(prev => { const n = {...prev}; delete n[siteId]; return n; });
  };

  /* ──────────── Renders ──────────── */
  
  if (!isLoggedIn) return (
    <div className="login-page">
      <ToastList toasts={toasts} />
      <div className="login-bg-blur login-bg-blur-1" />
      <div className="login-bg-blur login-bg-blur-2" />
      <div className="glass-card login-card">
        <div className="login-header">
          <div className="login-icon-wrap">🛰️</div>
          <h1 className="login-title">NANO MONITOR</h1>
          <p className="login-sub">SECURE DASHBOARD · {VERSION}</p>
        </div>
        {loginError && <div className="login-error">{loginError}</div>}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">管理员账号</label>
            <input
              className="input-field"
              type="text"
              required
              autoComplete="username"
              placeholder="admin"
              value={loginForm.user}
              onChange={e => setLoginForm({...loginForm, user: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">访问密码</label>
            <input
              className="input-field"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={loginForm.pass}
              onChange={e => setLoginForm({...loginForm, pass: e.target.value})}
            />
          </div>
          <button type="submit" className="login-btn" disabled={loginLoading}>
            {loginLoading ? <span className="spin-inline">⟳</span> : '🔑'} 确认登录授权
          </button>
        </form>
        <div className="login-footer">CONTROL ACCESS SYSTEM · {VERSION}</div>
      </div>
    </div>
  );

  return (
    <div className="page">
      <ToastList toasts={toasts} />
      <ConfirmDialog dialog={dialog} onClose={handleClose} />

      {snapshot && (
        <div className="modal-overlay" onClick={() => setSnapshot(null)}>
          <div className="glass-card modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">📸 {snapshot.name}</div>
                <div className="modal-sub">文本快照捕捉于 {timeAgo(snapshot.last_checked)}</div>
              </div>
              <button className="btn-icon" onClick={() => setSnapshot(null)}>✕</button>
            </div>
            <div className="snapshot-body">
              {snapshot.lines && snapshot.lines.length > 0
                ? snapshot.lines.map((l, i) => <div key={i} className="snapshot-line">{l}</div>)
                : <div className="empty-state">暂无捕捉到的网页快照</div>
              }
            </div>
          </div>
        </div>
      )}

      <header className="glass-card header">
        <div>
          <div className="header-logo">🛰️ NANO <span className="header-logo-light">MONITOR</span></div>
          <div className="header-sub"><span>SECURE SESSION</span> · <span>ACTIVE POLLING</span></div>
        </div>
        <div className="header-right">
          <div className="header-stats">
            <div className="stat-item">
              <div className="stat-label">ASSETS</div>
              <div className="stat-value">{sites.length}</div>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <div className="stat-label">ALERTS</div>
              <div className="stat-value">{changes.length}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>🚪 LOGOUT</button>
        </div>
      </header>

      <div className="main-grid">
        <aside className="sidebar">
          <div className="glass-card">
            <div className="card-header"><div className="card-header-title">➕ 建立新探测器</div></div>
            <div className="card-body">
              <form onSubmit={addSite}>
                <div className="form-group">
                  <label className="form-label">目标备注</label>
                  <input className="input-field" type="text" placeholder="资源名称" value={newSite.name} onChange={e => setNewSite({...newSite, name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">监控 URL</label>
                  <input className="input-field" type="url" placeholder="https://..." required value={newSite.url} onChange={e => setNewSite({...newSite, url: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">检测间隔 (秒，最少 10)</label>
                  <input className="input-field" type="number" min="10" value={newSite.interval} onChange={e => setNewSite({...newSite, interval: e.target.value})} />
                </div>
                <div className="btn-row">
                  <button type="button" className="btn-secondary" onClick={scanPage} disabled={discovering || !newSite.url} style={{flex:1}}>
                    {discovering ? <span className="spin-inline">⟳</span> : '🔍'} 预检
                  </button>
                  <button type="submit" className="btn-primary" disabled={loading} style={{flex:1.5}}>
                    {loading ? <span className="spin-inline">⟳</span> : '🚀'} 启动
                  </button>
                </div>
              </form>
              {discoveredItems.length > 0 && (
                <div className="discovered-list">
                  {discoveredItems.map((p, i) => (
                    <div key={i} className="glass-card discovered-item" onClick={() => setNewSite({...newSite, name: p.name, url: p.url})}>
                      <div className="discovered-name">{p.name}</div>
                      <div className="discovered-price">💰 {p.price}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="glass-card">
            <div className="card-header"><div className="card-header-title">⚙️ 系统配置</div></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Bark 通知令牌</label>
                <input className="input-field" type="password" placeholder="留空则不推送" value={barkKey} onChange={e => setBarkKey(e.target.value)} />
              </div>
              <button className="save-btn" onClick={() => api.post('/settings', { bark_key: barkKey }).then(() => toast('已更新', 'success'))}>保存配置</button>
            </div>
          </div>
          <div className="version-tag">ENGINE {VERSION}</div>
        </aside>

        <main className="content">
          <section className="glass-card">
            <div className="card-header">
              <div className="card-header-title">🌍 监视中的资产 ({sites.length})</div>
              <button className="refresh-btn" onClick={fetchData} title="刷新">🔄</button>
            </div>
            <div className="site-list">
              {sites.length === 0
                ? <div className="empty-state">待命状态 · 请添加目标</div>
                : sites.map(site => (
                  <div key={site.id} className={`site-item ${site.status === 'error' ? 'site-item-error' : ''}`}>
                    <div className="site-info">
                      <div className={`site-icon ${site.status === 'checking' || checking === site.id ? 'checking' : ''} ${site.status === 'error' ? 'error' : ''}`}>
                        {(checking === site.id || site.status === 'checking') ? '⟳' : site.status === 'error' ? '⚠️' : '🌐'}
                      </div>
                      <div className="site-meta">
                        <div className="site-name">{site.name || 'UNNAMED'}</div>
                        <span className="site-url" onClick={() => window.open(site.url, '_blank', 'noopener')}>{site.url}</span>
                        {site.status === 'error' && site.error_message && (
                          <div className="site-error-msg" title={site.error_message}>
                            ⚠️ {site.error_message.substring(0, 60)}{site.error_message.length > 60 ? '...' : ''}
                          </div>
                        )}
                        <div className="site-tags">
                          {editInterval[site.id] !== undefined ? (
                            <div className="interval-edit">
                              <input
                                className="interval-input"
                                type="number"
                                min="10"
                                value={editInterval[site.id]}
                                onChange={e => setEditInterval({...editInterval, [site.id]: e.target.value})}
                                onKeyDown={e => { if (e.key === 'Enter') updateInterval(site.id); if (e.key === 'Escape') cancelEditInterval(site.id); }}
                                autoFocus
                              />
                              <button className="interval-btn ok" onClick={() => updateInterval(site.id)} title="保存">✓</button>
                              <button className="interval-btn cancel" onClick={() => cancelEditInterval(site.id)} title="取消">✕</button>
                            </div>
                          ) : (
                            <span className="site-tag clickable" onClick={() => setEditInterval({...editInterval, [site.id]: site.interval})} title="点击修改间隔">⏱️ {site.interval}s</span>
                          )}
                          {site.last_checked && <span className="site-tag">🕒 {timeAgo(site.last_checked)}</span>}
                          {site.status === 'error'
                            ? <span className="badge badge-error">ERROR</span>
                            : site.status === 'idle'
                              ? <span className="badge badge-active">ONLINE</span>
                              : <span className="badge badge-check">POLLING</span>
                          }
                        </div>
                      </div>
                    </div>
                    <div className="site-actions">
                      <button className="btn-icon" onClick={() => viewSnapshot(site.id)} title="查看快照">📸</button>
                      <button className="btn-icon" onClick={() => checkNow(site.id)} disabled={!!checking} title="立即检查">⚡</button>
                      <button className="btn-icon danger" onClick={() => deleteSite(site.id)} title="删除">🗑️</button>
                    </div>
                  </div>
                ))
              }
            </div>
          </section>

          <section className="glass-card">
            <div className="card-header">
              <div className="card-header-title">🔔 关键变动序列</div>
              <span className="badge badge-live">LIVE FEED</span>
            </div>
            <div className="changes-list">
              {Object.keys(groups).length === 0
                ? <div className="empty-state">静默状态 · 暂无数据</div>
                : Object.entries(groups).map(([siteId, g]) => (
                  <div key={siteId} className="change-group">
                    <div
                      className={`change-group-header ${expandedSite === siteId ? 'expanded' : ''}`}
                      onClick={() => setExpandedSite(expandedSite === siteId ? null : siteId)}
                    >
                      <div>
                        <div className="change-group-name">{g.name}</div>
                        <div className="change-group-meta">{g.items.length} 条变动 · 最后于 {timeAgo(g.items[0].detected_at)}</div>
                      </div>
                      <div className="change-group-actions">
                        <span className="change-chevron">{expandedSite === siteId ? '▲' : '▼'}</span>
                        <button
                          className="btn-icon danger"
                          style={{width:28, height:28}}
                          onClick={e => { e.stopPropagation(); confirm('确认清空该站点的全部变动记录？').then(ok => { if (ok) api.delete(`/changes/${siteId}`).then(fetchData); }); }}
                          title="清空变动"
                        >🗑️</button>
                      </div>
                    </div>
                    {expandedSite === siteId && (
                      <div className="change-items">
                        {g.items.map(c => (
                          <div key={c.id} className="change-item">
                            <div className="change-time">{timeAgo(c.detected_at)}</div>
                            <div className="change-desc">{c.diff_summary}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
