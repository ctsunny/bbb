import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';

const API_BASE = '/api';
const VERSION  = 'v1.6.0';

// Global error listener for debugging
window.addEventListener('error', e => {
  if (e.message?.indexOf('ResizeObserver') === -1) {
    alert('JS崩溃: ' + (e.message || '未知错误'));
  }
});

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

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken]           = useState(null);
  const [loginForm, setLoginForm]   = useState({ user: '', pass: '' });
  const [sites,    setSites]        = useState([]);
  const [changes,  setChanges]      = useState([]);
  const [barkKey,  setBarkKey]      = useState('');
  const [newSite,  setNewSite]      = useState({ url: '', name: '', interval: 60 });
  const [loading,  setLoading]      = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoveredItems, setDiscoveredItems] = useState([]);
  const [checking, setChecking]     = useState(null);
  const [message,  setMessage]      = useState('');
  const [expandedSite, setExpandedSite] = useState(null);
  const [snapshot, setSnapshot]     = useState(null);
  const [editInterval, setEditInterval] = useState({});

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
      const t = setInterval(fetchData, 12000);
      return () => clearInterval(t);
    }
  }, [isLoggedIn, fetchData]);

  // ── Memoized Groups to prevent crashes ───────────────────
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
  const flash = (msg) => { setMessage(msg); setTimeout(() => setMessage(''), 3000); };
  
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/login', loginForm);
      const tk = res.data.token;
      api.defaults.headers.common['Authorization'] = tk;
      localStorage.setItem('access_token', tk);
      setToken(tk); setIsLoggedIn(true);
      fetchData();
    } catch { alert('登录失败，请检查账号密码'); }
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
      flash('✅ 监控目标已同步');
      fetchData();
    } catch (err) { alert(err.response?.data?.error || '添加失败'); }
    setLoading(false);
  };

  const scanPage = async () => {
    if (!newSite.url) return alert('请输入目标网址');
    setDiscovering(true);
    try {
      const res = await api.get(`/discover?url=${encodeURIComponent(newSite.url)}`);
      // Wait, standardizing on POST was better, let's keep POST
    } catch {}
    // Rewrote to use the previous logic but safer
    try {
      const res = await api.post('/discover', { url: newSite.url });
      setDiscoveredItems(res.data.products || []);
      flash(res.data.products?.length > 0 ? `✨ 发现 ${res.data.products.length} 个目标` : '⚠️ 未发现商品');
    } catch (err) { alert('扫描失败：' + (err.response?.data?.error || err.message)); }
    setDiscovering(false);
  };

  const deleteSite = async (id) => {
    if (!window.confirm('确认物理删除该站点及历史？')) return;
    try { await api.delete(`/sites/${id}`); flash('🗑️ 已移除'); fetchData(); } catch (err) { alert('操作失败'); }
  };

  const checkNow = async (id) => {
    setChecking(id);
    try { await api.post(`/check-now/${id}`); flash('⚡ 检查指令已下达'); } catch(err) { alert('触发失败'); }
    setTimeout(fetchData, 2000);
    setChecking(null);
  };

  const viewSnapshot = async (id) => {
    try {
      const res = await api.get(`/snapshot/${id}`);
      setSnapshot(res.data);
    } catch { alert('获取快照失败'); }
  };

  const updateInterval = async (siteId) => {
    const val = editInterval[siteId];
    if (!val || isNaN(val)) return;
    try {
      await api.patch(`/sites/${siteId}`, { interval: Number(val) });
      flash('✅ 频率已调整');
      setEditInterval(prev => { const n = {...prev}; delete n[siteId]; return n; });
      fetchData();
    } catch (err) { alert('更新失败'); }
  };

  /* ──────────── Renders ──────────── */
  
  if (!isLoggedIn) return (
    <div className="login-page">
      <div className="glass-card login-card" style={{animation:'fadeInLeft 0.5s ease'}}>
        <div className="login-header">
          <h1 className="login-title"><span className="login-title-icon">🔑</span> NANO MONITOR</h1>
          <p className="login-sub">PREMIUM DASHBOARD · {VERSION}</p>
        </div>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">管理员账号</label>
            <input className="input-field" type="text" required value={loginForm.user} onChange={e => setLoginForm({...loginForm, user: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">访问密码</label>
            <input className="input-field" type="password" required value={loginForm.pass} onChange={e => setLoginForm({...loginForm, pass: e.target.value})} />
          </div>
          <button type="submit" className="login-btn">确认登录授权</button>
        </form>
        <div className="login-footer">CONTROL ACCESS SYSTEM v{VERSION}</div>
      </div>
    </div>
  );

  return (
    <div className="page" style={{animation:'fadeIn 0.3s ease'}}>
      {snapshot && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:24}} onClick={() => setSnapshot(null)}>
          <div className="glass-card" onClick={e => e.stopPropagation()} style={{width:'100%', maxWidth:750, maxHeight:'85vh', overflow:'auto', padding:28, border:'1px solid var(--primary)'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:20}}>
              <div>
                <div style={{fontWeight:900, fontSize:18, color:'var(--primary)'}}>📸 {snapshot.name}</div>
                <div style={{fontSize:11, color:'var(--muted)', marginTop:4}}>文本快照捕捉于 {timeAgo(snapshot.last_checked)}</div>
              </div>
              <button className="btn-icon" onClick={() => setSnapshot(null)}>✕</button>
            </div>
            <div style={{background:'rgba(0,0,0,0.4)', borderRadius:12, padding:20, fontSize:12, lineHeight:1.8, color:'#cbd5e1', whiteSpace:'pre-wrap'}}>
              {snapshot.lines && snapshot.lines.length > 0
                ? snapshot.lines.map((l, i) => <div key={i} style={{borderBottom:'1px solid rgba(255,255,255,0.03)', paddingBottom:6, marginBottom:6}}>{l}</div>)
                : <div style={{textAlign:'center', opacity:0.3, padding:40}}>暂无捕捉到的网页快照</div>
              }
            </div>
          </div>
        </div>
      )}

      <header className="glass-card header">
        <div>
          <div className="header-logo" style={{color:'var(--primary)'}}>🛰️ NANO <span style={{color:'#fff', fontWeight:400}}>MONITOR</span></div>
          <div className="header-sub"><span>SECURE SESSION</span> · <span>ACTIVE POLLING</span></div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:32}}>
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

      {message && <div className="message-bar" style={{animation:'fadeIn 0.2s ease'}}>{message}</div>}

      <div className="main-grid">
        <aside className="sidebar">
          <div className="glass-card">
            <div className="card-header"><div className="card-header-title">➕ 建立新探测器</div></div>
            <div className="card-body">
              <form onSubmit={addSite}>
                <div className="form-group"><label className="form-label">目标备注</label><input className="input-field" type="text" placeholder="资源名称" value={newSite.name} onChange={e => setNewSite({...newSite, name: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">监控 URL</label><input className="input-field" type="url" placeholder="https://..." required value={newSite.url} onChange={e => setNewSite({...newSite, url: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">检测间隔 (S)</label><input className="input-field" type="number" min="10" value={newSite.interval} onChange={e => setNewSite({...newSite, interval: e.target.value})} /></div>
                <div style={{display:'flex', gap:8, marginTop:16}}>
                  <button type="button" className="btn-secondary" onClick={scanPage} disabled={discovering || !newSite.url} style={{flex:1}}>{discovering ? '...' : '🔍 预检'}</button>
                  <button type="submit" className="btn-primary" disabled={loading} style={{flex:1.5}}>{loading ? '...' : '🚀 启动'}</button>
                </div>
              </form>
              {discoveredItems.length > 0 && (
                <div style={{marginTop:24, borderTop:'1px solid var(--border)', paddingTop:20}}>
                  <div style={{maxHeight:300, overflowY:'auto', display:'flex', flexDirection:'column', gap:10}}>
                    {discoveredItems.map((p, i) => (
                      <div key={i} className="glass-card" onClick={() => setNewSite({...newSite, name: p.name, url: p.url})} style={{padding:12, fontSize:12, cursor:'pointer'}}>
                        <div style={{color:'var(--primary)', fontWeight:700, marginBottom:4}}>{p.name}</div>
                        <div style={{opacity:0.6}}>💰 {p.price}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="glass-card">
            <div className="card-header"><div className="card-header-title">⚙️ 系统配置</div></div>
            <div className="card-body">
              <div className="form-group"><label className="form-label">Bark 通知令牌</label><input className="input-field" type="password" value={barkKey} onChange={e => setBarkKey(e.target.value)} /></div>
              <button className="save-btn" onClick={() => api.post('/settings', { bark_key: barkKey }).then(() => flash('已更新'))}>保存配置</button>
            </div>
          </div>
          <div style={{textAlign:'center', opacity:0.3, fontSize:9, letterSpacing:'0.2em', fontWeight:800}}>ENGINE v{VERSION}</div>
        </aside>

        <main className="content">
          <section className="glass-card">
            <div className="card-header"><div className="card-header-title">🌍 监视中的资产 ({sites.length})</div><button className="refresh-btn" onClick={fetchData}>🔄</button></div>
            <div className="site-list">
              {sites.length === 0 ? <div className="empty-state">待命状态 · 请添加目标</div> : sites.map(site => (
                <div key={site.id} className="site-item">
                  <div className="site-info">
                    <div className={`site-icon ${site.status==='checking'?'checking':''}`}>{(checking===site.id || site.status==='checking') ? '⟳' : '🌐'}</div>
                    <div className="site-meta">
                      <div className="site-name">{site.name || 'UNNAMED'}</div>
                      <span className="site-url" onClick={() => window.open(site.url)}>{site.url}</span>
                      <div className="site-tags">
                        <span className="site-tag" style={{cursor:'pointer'}} onClick={() => setEditInterval({...editInterval, [site.id]: site.interval})}>⏱️ {site.interval}s</span>
                        {site.last_checked && <span className="site-tag">🕒 {timeAgo(site.last_checked)}</span>}
                        {site.status==='idle' ? <span className="badge badge-active">ONLINE</span> : <span className="badge badge-check">POLLING</span>}
                      </div>
                    </div>
                  </div>
                  <div className="site-actions">
                    <button className="btn-icon" onClick={() => viewSnapshot(site.id)}>📸</button>
                    <button className="btn-icon" onClick={() => checkNow(site.id)} disabled={!!checking}>⚡</button>
                    <button className="btn-icon danger" onClick={() => deleteSite(site.id)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-card">
            <div className="card-header"><div className="card-header-title">🔔 关键变动序列</div><span className="badge badge-live">LIVE FEED</span></div>
            <div style={{maxHeight:500, overflowY:'auto'}}>
              {Object.keys(groups).length === 0 ? <div className="empty-state">静默状态 · 暂无数据</div> : Object.entries(groups).map(([siteId, g]) => (
                <div key={siteId} style={{borderBottom:'1px solid var(--border)'}}>
                  <div onClick={() => setExpandedSite(expandedSite === siteId ? null : siteId)} style={{padding:'16px 24px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', background: expandedSite === siteId ? 'rgba(14,165,233,0.05)' : ''}}>
                    <div><div style={{fontWeight:800, fontSize:13}}>{g.name}</div><div style={{fontSize:10, opacity:0.5}}>{g.items.length} 条变动 · 最后于 {timeAgo(g.items[0].detected_at)}</div></div>
                    <button className="btn-icon danger" style={{width:28, height:28}} onClick={e => { e.stopPropagation(); api.delete(`/changes/${siteId}`).then(fetchData); }}>🗑️</button>
                  </div>
                  {expandedSite === siteId && (
                    <div style={{padding:'8px 0 16px 50px'}}>
                      {g.items.map(c => (
                        <div key={c.id} style={{padding:'12px 0', borderLeft:'2px solid var(--primary)', paddingLeft:16, marginBottom:8}}>
                          <div style={{fontSize:10, fontWeight:800, color:'var(--muted)', marginBottom:4}}>{timeAgo(c.detected_at)}</div>
                          <div style={{fontSize:12, whiteSpace:'pre-wrap', color:'#e2e8f0'}}>{c.diff_summary}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
