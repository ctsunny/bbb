import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE = '/api';
const VERSION  = 'v1.5.4';

window.addEventListener('error', e => {
  if (e.message.indexOf('ResizeObserver') === -1) { // Ignore harmless ResizeObserver noise
    alert('JS崩溃: ' + e.message + ' at ' + e.filename + ':' + e.lineno);
  }
});

const timeAgo = (dt) => {
  if (!dt) return '从未';
  const d = new Date(dt);
  if (isNaN(d.getTime())) return '未知';
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 0)   return '刚刚';
  if (s < 60)  return `${s} 秒前`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
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
  const [snapshot, setSnapshot]     = useState(null); // { name, lines }
  const [editInterval, setEditInterval] = useState({}); // { siteId: value }

  // ── Axios 401 interceptor ───────────────────────────────
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

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = token;
      localStorage.setItem('access_token', token);
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const fetchData = useCallback(async () => {
    try {
      const { data: s } = await api.get('/sites');
      const { data: c } = await api.get('/changes');
      const { data: cfg } = await api.get('/config');
      setSites(s?.sites || []);
      setChanges(c?.changes || []);
      setBarkKey(cfg?.bark_key || '');
    } catch(e) { console.error('Fetch Error:', e); }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('access_token');
    if (stored) {
      api.defaults.headers.common['Authorization'] = stored;
      api.get('/sites')
        .then(() => { setToken(stored); setIsLoggedIn(true); fetchData(); })
        .catch(() => localStorage.removeItem('access_token'));
    }
  }, [fetchData]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const t = setInterval(fetchData, 10000);
    return () => clearInterval(t);
  }, [isLoggedIn, fetchData]);

  const flash = (msg) => { setMessage(msg); setTimeout(() => setMessage(''), 3000); };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/login', loginForm);
      setToken(res.data.token); setIsLoggedIn(true);
      setTimeout(fetchData, 100);
    } catch { alert('登录失败'); }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    setToken(null); setIsLoggedIn(false);
  };

  const addSite = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await api.post('/sites', newSite);
      setNewSite({ url: '', name: '', interval: 60 });
      setDiscoveredItems([]);
      flash('✅ 监控目标已添加！');
      fetchData();
    } catch (err) { alert(err.response?.data?.error || '添加失败'); }
    setLoading(false);
  };

  const scanPage = async () => {
    if (!newSite.url) return alert('请输入目标网址');
    setDiscovering(true);
    try {
      const res = await api.post('/discover', { url: newSite.url });
      setDiscoveredItems(res.data.products || []);
      flash(res.data.products?.length > 0
        ? `✨ 发现 ${res.data.products.length} 个目标` : '⚠️ 未发现商品');
    } catch (err) { alert('扫描失败：' + (err.response?.data?.error || err.message)); }
    setDiscovering(false);
  };

  const selectProduct = (p) => {
    setNewSite({ ...newSite, name: p.name, url: p.url?.startsWith('http') ? p.url : newSite.url });
  };

  const deleteSite = async (id) => {
    if (!window.confirm('确认删除？相关历史同时清除')) return;
    try { await api.delete(`/sites/${id}`); flash('🗑️ 已删除'); fetchData(); }
    catch (err) { alert('删除失败：' + (err.response?.data?.error || err.message)); }
  };

  const checkNow = async (id) => {
    setChecking(id);
    try { await api.post(`/check-now/${id}`); flash('⚡ 检查已触发'); fetchData(); }
    catch (err) { alert(err.response?.data?.error || '检查失败'); }
    setChecking(null);
  };

  const saveBark = async () => {
    try { await api.post('/settings', { bark_key: barkKey }); flash('✅ Bark 已保存'); }
    catch { alert('保存失败'); }
  };

  const clearChanges = async (siteId, e) => {
    e.stopPropagation();
    if (!window.confirm('确认清除该站点所有历史？')) return;
    try { await api.delete(`/changes/${siteId}`); flash('🗑️ 已清除'); fetchData(); }
    catch (err) { alert('清除失败：' + (err.response?.data?.error || err.message)); }
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
      flash('✅ 扫描间隔已更新');
      setEditInterval(prev => { const n = {...prev}; delete n[siteId]; return n; });
      fetchData();
    } catch (err) { alert('更新失败：' + (err.response?.data?.error || err.message)); }
  };

  /* ──────────── 登录页 ──────────── */
  if (!isLoggedIn) return (
    <div className="login-page">
      <div className="glass-card login-card">
        <div className="login-header">
          <h1 className="login-title"><span className="login-title-icon">🔑</span> 管理后台</h1>
          <p className="login-sub">NanoMonitor · {VERSION}</p>
        </div>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">账号</label>
            <input className="input-field" type="text" required
              value={loginForm.user} onChange={e => setLoginForm({...loginForm, user: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">密码</label>
            <input className="input-field" type="password" required
              value={loginForm.pass} onChange={e => setLoginForm({...loginForm, pass: e.target.value})} />
          </div>
          <button type="submit" className="login-btn">确认登录</button>
        </form>
        <div className="login-footer">&copy; 2026 NanoMonitor {VERSION}</div>
      </div>
    </div>
  );

  // Group changes by site (only calc if logged in)
  const groups = (changes || []).reduce((acc, c) => {
    if (!acc[c.site_id]) acc[c.site_id] = { name: c.site_name, url: c.site_url, items: [] };
    acc[c.site_id].items.push(c);
    return acc;
  }, {});

  /* ──────────── 快照弹窗 ──────────── */
  const SnapshotModal = snapshot ? (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:999, padding:24
    }} onClick={() => setSnapshot(null)}>
      <div className="glass-card" onClick={e => e.stopPropagation()} style={{
        width:'100%', maxWidth:700, maxHeight:'80vh', overflow:'auto', padding:24
      }}>
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:16}}>
          <div>
            <div style={{fontWeight:900, fontSize:16}}>📸 {snapshot.name}</div>
            <div style={{fontSize:11, color:'var(--muted)', marginTop:4}}>最近快照 · {timeAgo(snapshot.last_checked)}</div>
          </div>
          <button className="btn-icon" onClick={() => setSnapshot(null)}>✕</button>
        </div>
        <div style={{
          background:'rgba(0,0,0,0.3)', borderRadius:10, padding:16,
          fontSize:12, lineHeight:1.8, color:'var(--muted)', whiteSpace:'pre-wrap', wordBreak:'break-all'
        }}>
          {snapshot.lines?.length > 0
            ? snapshot.lines.map((l, i) => <div key={i} style={{borderBottom:'1px solid rgba(255,255,255,0.03)', paddingBottom:4, marginBottom:4}}>{l}</div>)
            : <div style={{textAlign:'center', opacity:0.3}}>暂无快照数据</div>
          }
        </div>
      </div>
    </div>
  ) : null;

  /* ──────────── 主面板 ──────────── */
  return (
    <div className="page">
      {SnapshotModal}
      <header className="glass-card header">
        <div>
          <div className="header-logo">
            <span className="header-icon">🛰️</span> 监控面板
            <span style={{color:'var(--primary)',fontWeight:400,fontSize:18,fontStyle:'italic',marginRight:8}}>控制台</span>
            <span className="badge badge-active" style={{verticalAlign:'middle',fontSize:10}}>{VERSION}</span>
          </div>
          <div className="header-sub">🛡️ <span>安全会话进行中</span></div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:32}}>
          <div className="header-stats">
            <div className="stat-item">
              <div className="stat-label">监控目标</div>
              <div className="stat-value">{sites.length}</div>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <div className="stat-label">历史变动</div>
              <div className="stat-value">{changes.length}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>🚪 退出</button>
        </div>
      </header>

      {message && <div className="message-bar">{message}</div>}

      <div className="main-grid">
        <div className="sidebar">
          <div className="glass-card">
            <div className="card-header"><div className="card-header-title">➕ 新增探测目标</div></div>
            <div className="card-body">
              <form onSubmit={addSite}>
                <div className="form-group">
                  <label className="form-label">备注名称</label>
                  <input className="input-field" type="text" placeholder="VPS 抢购页"
                    value={newSite.name} onChange={e => setNewSite({...newSite, name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">目标网址</label>
                  <input className="input-field" type="url" placeholder="https://..." required
                    value={newSite.url} onChange={e => setNewSite({...newSite, url: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">扫描间隔（秒）</label>
                  <input className="input-field" type="number" min="10" placeholder="60"
                    value={newSite.interval} onChange={e => setNewSite({...newSite, interval: e.target.value})} />
                </div>
                <div style={{display:'flex',gap:8,marginTop:12}}>
                  <button type="button" className="btn-secondary" onClick={scanPage}
                    disabled={discovering || !newSite.url} style={{flex:1}}>
                    {discovering ? <span className="spin">⟳</span> : '🔍'} 扫描商品
                  </button>
                  <button type="submit" className="btn-primary" disabled={loading} style={{flex:1.5}}>
                    {loading ? <span className="spin">⟳</span> : '🚀'} 激活探测器
                  </button>
                </div>
              </form>
              {discoveredItems.length > 0 && (
                <div style={{marginTop:20, borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:15}}>
                  <label className="form-label" style={{display:'block', marginBottom:10}}>✨ 识别结果 (点击选择):</label>
                  <div style={{maxHeight:250, overflowY:'auto', display:'flex', flexDirection:'column', gap:8}}>
                    {discoveredItems.map((p, i) => (
                      <div key={i} className="glass-card" onClick={() => selectProduct(p)}
                        style={{padding:10, fontSize:13, cursor:'pointer', border:'1px solid rgba(255,255,255,0.06)'}}>
                        <div style={{fontWeight:'bold', color:'var(--primary)', marginBottom:4}}>{p.name}</div>
                        <div style={{display:'flex', justifyContent:'space-between', opacity:0.8}}>
                          <span>💰 {p.price}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="glass-card">
            <div className="card-header"><div className="card-header-title">⚙️ 推送配置</div></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Bark Token</label>
                <input className="input-field" type="password" placeholder="输入 Bark Key"
                  value={barkKey} onChange={e => setBarkKey(e.target.value)} />
              </div>
              <button className="save-btn" onClick={saveBark}>保存配置</button>
            </div>
          </div>
        </div>

        <div className="content">
          <div className="glass-card">
            <div className="card-header">
              <div className="card-header-title">🌍 监视中的资产 ({sites.length})</div>
              <button className="refresh-btn" onClick={fetchData} title="刷新">🔄</button>
            </div>
            <div className="site-list">
              {sites.length === 0
                ? <div className="empty-state">暂无监控目标</div>
                : sites.map(site => (
                  <div key={site.id} className="site-item">
                    <div className="site-info">
                      <div className={`site-icon${site.status==='checking'?' checking':site.status==='error'?' error':''}`}>
                        {(checking===site.id || site.status==='checking')
                          ? <span className="spin" style={{fontSize:18}}>⟳</span> : '🌐'}
                      </div>
                      <div className="site-meta">
                        <div className="site-name">{site.name || '未命名'}</div>
                        <span className="site-url" onClick={() => window.open(site.url,'_blank')} title={site.url}>
                          {site.url}
                        </span>
                        <div className="site-tags">
                          {editInterval[site.id] !== undefined ? (
                            <span style={{display:'flex', alignItems:'center', gap:4}}>
                              <input type="number" min="10" style={{width:55, padding:'2px 4px', fontSize:10,
                                background:'rgba(0,0,0,0.3)', border:'1px solid var(--primary)', borderRadius:4, color:'#fff'}}
                                value={editInterval[site.id]}
                                onChange={e => setEditInterval({...editInterval, [site.id]: e.target.value})}
                                onKeyDown={e => e.key === 'Enter' && updateInterval(site.id)} />
                              <span style={{fontSize:9, cursor:'pointer', color:'var(--primary)'}}
                                onClick={() => updateInterval(site.id)}>✓</span>
                              <span style={{fontSize:9, cursor:'pointer', color:'var(--muted)'}}
                                onClick={() => setEditInterval(prev => { const n={...prev}; delete n[site.id]; return n; })}>✕</span>
                            </span>
                          ) : (
                            <span className="site-tag" style={{cursor:'pointer'}}
                              onClick={() => setEditInterval({...editInterval, [site.id]: site.interval || 60})}
                              title="点击修改扫描间隔">
                              ⏱️ {site.interval || 60}s
                            </span>
                          )}
                          {site.last_checked && <span className="site-tag">🕒 {timeAgo(site.last_checked)}</span>}
                          {site.status==='error' && <span className="badge badge-error" title={site.error_message}>✕ 错误</span>}
                          {site.last_checked && site.status==='idle' && <span className="badge badge-active">● 正常</span>}
                        </div>
                        {site.status==='error' && site.error_message && (
                          <div style={{fontSize:11, color:'#f87171', marginTop:4, maxWidth:360, wordBreak:'break-all', opacity:0.85}}>
                            ⚠️ {site.error_message.substring(0, 150)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="site-actions">
                      <button className="btn-icon" onClick={() => viewSnapshot(site.id)} title="查看快照">📸</button>
                      <button className="btn-icon" onClick={() => checkNow(site.id)} title="立即检查"
                        disabled={!!checking}>⚡</button>
                      <button className="btn-icon danger" onClick={() => deleteSite(site.id)} title="删除">🗑️</button>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>

          <div className="glass-card">
            <div className="card-header">
              <div className="card-header-title">🔔 变动警报 Feed</div>
              <span className="badge badge-live">实时同步</span>
            </div>
            {Object.keys(groups).length === 0
              ? <div className="empty-state">暂无变动信号</div>
              : Object.entries(groups).map(([siteId, g]) => (
                <div key={siteId} style={{borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                  <div onClick={() => setExpandedSite(expandedSite === siteId ? null : siteId)}
                    style={{display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'14px 24px', cursor:'pointer',
                      background: expandedSite === siteId ? 'rgba(14,165,233,0.05)' : 'transparent'}}>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <span style={{fontSize:16}}>{expandedSite === siteId ? '▾' : '▸'}</span>
                      <div>
                        <div style={{fontWeight:800, fontSize:13}}>{g.name}</div>
                        <div style={{fontSize:11, color:'var(--muted)', marginTop:2}}>
                          {g.items.length} 条 · 最近 {timeAgo(g.items[0].detected_at)}
                        </div>
                      </div>
                    </div>
                    <button className="btn-icon danger" title="清除该站点历史"
                      onClick={e => clearChanges(siteId, e)} style={{width:32, height:32, fontSize:12}}>🗑️</button>
                  </div>
                  {expandedSite === siteId && (
                    <div style={{paddingBottom:8}}>
                      {g.items.map(c => (
                        <div key={c.id} className="change-item" style={{paddingLeft:48}}>
                          <div className="change-icon">📢</div>
                          <div className="change-body">
                            <div className="change-row">
                              <span className="change-name" style={{fontSize:11, opacity:0.7}}>{timeAgo(c.detected_at)}</span>
                            </div>
                            <div className="change-desc" style={{whiteSpace:'pre-line'}}>{c.diff_summary}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        </div>
      </div>
      <footer>&copy; 2026 NanoMonitor {VERSION}</footer>
    </div>
  );
}
