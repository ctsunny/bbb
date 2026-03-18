import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE = '/api';

// Simple time ago
const timeAgo = (dt) => {
  const diff = Date.now() - new Date(dt).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
};

// Global axios defaults
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

  // 1. Setup Axios Interceptors for Global 401 Protection
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response && err.response.status === 401) {
          localStorage.removeItem('access_token');
          setToken(null);
          setIsLoggedIn(false);
        }
        return Promise.reject(err);
      }
    );
    return () => api.interceptors.response.eject(interceptor);
  }, []);

  // 2. Set token header globally whenever token changes
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = token;
      localStorage.setItem('access_token', token);
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // 3. Data fetching
  const fetchData = useCallback(async () => {
    try {
      const [s, c, cfg] = await Promise.all([
        api.get(`/sites`),
        api.get(`/changes`),
        api.get(`/config`),
      ]);
      setSites(s.data.sites);
      setChanges(c.data.changes);
      setBarkKey(cfg.data.bark_key || '');
    } catch(e) { console.error("Fetch Data Error:", e); }
  }, []);

  // 4. Initial Auth Check on Mount
  useEffect(() => {
    const storedToken = localStorage.getItem('access_token');
    if (storedToken) {
      // Set the default header synchronously so immediate subsequent requests don't fail
      api.defaults.headers.common['Authorization'] = storedToken;
      api.get(`/sites`)
        .then(() => {
          setToken(storedToken);
          setIsLoggedIn(true);
          fetchData();
        })
        .catch(() => {
          localStorage.removeItem('access_token');
        });
    }
  }, [fetchData]);

  // 5. Polling
  useEffect(() => {
    if (!isLoggedIn) return;
    const t = setInterval(() => fetchData(), 10000);
    return () => clearInterval(t);
  }, [isLoggedIn, fetchData]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/login`, loginForm);
      setToken(res.data.token);
      setIsLoggedIn(true);
      setTimeout(() => fetchData(), 100); // slight delay to ensure headers are applied
    } catch (e) { 
      alert('登录失败：用户名或密码错误'); 
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    setToken(null); 
    setIsLoggedIn(false);
  };

  const addSite = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/sites`, newSite);
      setNewSite({ url: '', name: '', interval: 60 });
      setDiscoveredItems([]); // Clear after adding
      setMessage('监控目标已添加！');
      setTimeout(() => setMessage(''), 3000);
      fetchData();
    } catch (err) { alert(err.response?.data?.error || '添加失败'); }
    setLoading(false);
  };

  const scanPage = async () => {
    if (!newSite.url) return alert('请输入目标网址');
    setDiscovering(true);
    try {
      const res = await api.post('/discover', { url: newSite.url });
      setDiscoveredItems(res.data.products);
      if (res.data.products.length === 0) setMessage('未在页面上发现明显商品');
      else setMessage(`发现 ${res.data.products.length} 个可能的目标`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      alert('扫描失败：' + (err.response?.data?.error || err.message));
    }
    setDiscovering(false);
  };

  const selectProduct = (p) => {
    setNewSite({
      ...newSite,
      name: p.name,
      // If the product has a specific URL, we use it, otherwise keep the scan URL
      url: p.url && p.url.startsWith('http') ? p.url : newSite.url 
    });
  };

  const deleteSite = async (id) => {
    if (!window.confirm('确认删除该监控目标？')) return;
    await api.delete(`/sites/${id}`);
    fetchData();
  };

  const checkNow = async (id) => {
    setChecking(id);
    try {
      await api.post(`/check-now/${id}`);
      fetchData();
    } catch (err) { alert(err.response?.data?.error || '检查失败'); }
    setChecking(null);
  };

  const saveBark = async () => {
    try {
      await api.post(`/settings`, { bark_key: barkKey });
      alert('Bark 配置已保存！');
    } catch { alert('保存失败'); }
  };

  /* ========== 登录页 ========== */
  if (!isLoggedIn) return (
    <div className="login-page">
      <div className="glass-card login-card">
        <div className="login-header">
          <h1 className="login-title">
            <span className="login-title-icon">🔑</span>
            管理后台
          </h1>
          <p className="login-sub">NanoMonitor Console</p>
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
        <div className="login-footer">&copy; 2026 安全链路已加密 · NanoMonitor</div>
      </div>
    </div>
  );

  /* ========== 主仪表盘 ========== */
  return (
    <div className="page">
      {/* 顶栏 */}
      <header className="glass-card header">
        <div>
          <div className="header-logo">
            <span className="header-icon">🛰️</span>
            监控面板
            <span style={{color:'var(--primary)',fontWeight:400,fontSize:18,fontStyle:'italic'}}>控制台</span>
          </div>
          <div className="header-sub">
            🛡️ <span>安全会话进行中</span>
          </div>
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
          <button className="logout-btn" onClick={handleLogout}>
            🚪 退出
          </button>
        </div>
      </header>

      {message && <div className="message-bar">{message}</div>}

      <div className="main-grid">
        {/* 左侧栏 */}
        <div className="sidebar">
          <div className="glass-card">
            <div className="card-header">
              <div className="card-header-title">➕ 新增探测目标</div>
            </div>
            <div className="card-body">
              <form onSubmit={addSite}>
                <div className="form-group">
                  <label className="form-label">备注名称</label>
                  <input className="input-field" type="text" placeholder="例如：VPS 抢购页"
                    value={newSite.name} onChange={e => setNewSite({...newSite, name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">目标网址</label>
                  <input className="input-field" type="url" placeholder="https://..." required
                    value={newSite.url} onChange={e => setNewSite({...newSite, url: e.target.value})} />
                </div>
                <div className="form-actions" style={{display:'flex',gap:8,marginTop:12}}>
                  <button type="button" className="btn-secondary" onClick={scanPage} disabled={discovering || !newSite.url} style={{flex:1}}>
                    {discovering ? <span className="spin">⟳</span> : '🔍'} 扫描商品
                  </button>
                  <button type="submit" className="btn-primary" disabled={loading} style={{flex:1.5}}>
                    {loading ? <span className="spin">⟳</span> : '🚀'} 激活探测器
                  </button>
                </div>
              </form>

              {discoveredItems.length > 0 && (
                <div className="discovery-results" style={{marginTop:20, borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:15}}>
                  <label className="form-label" style={{display:'block', marginBottom:10}}>✨ 智能识别结果 (点击选择):</label>
                  <div className="discovery-list" style={{maxHeight:300, overflowY:'auto', display:'flex', flexDirection:'column', gap:8}}>
                    {discoveredItems.map((p, idx) => (
                      <div key={idx} className="discovery-item glass-card" onClick={() => selectProduct(p)} 
                        style={{padding:'10px', fontSize:13, cursor:'pointer', transition:'transform 0.2s', border:'1px solid rgba(255,255,255,0.05)'}}>
                        <div style={{fontWeight:'bold', color:'var(--primary)', marginBottom:4}}>{p.name}</div>
                        <div style={{display:'flex', justifyContent:'space-between', opacity:0.8}}>
                          <span>💰 {p.price}</span>
                          {p.image && <span title="包含图片">🖼️</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="glass-card">
            <div className="card-header">
              <div className="card-header-title">⚙️ 推送配置</div>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Bark Token</label>
                <input className="input-field" type="password" placeholder="输入你的 Bark Key"
                  value={barkKey} onChange={e => setBarkKey(e.target.value)} />
              </div>
              <button className="save-btn" onClick={saveBark}>保存配置</button>
            </div>
          </div>
        </div>

        {/* 右侧主区 */}
        <div className="content">
          <div className="glass-card">
            <div className="card-header">
              <div className="card-header-title">🌍 监视中的资产 ({sites.length})</div>
              <button className="refresh-btn" onClick={() => fetchData()} title="刷新">🔄</button>
            </div>
            <div className="site-list">
              {sites.length === 0
                ? <div className="empty-state">暂无监控目标，请在左侧添加网址</div>
                : sites.map(site => (
                  <div key={site.id} className="site-item">
                    <div className="site-info">
                      <div className={`site-icon${site.status==='checking'?' checking':site.status==='error'?' error':''}`}>
                        {(checking===site.id||site.status==='checking')
                          ? <span className="spin" style={{fontSize:18}}>⟳</span>
                          : '🌐'}
                      </div>
                      <div className="site-meta">
                        <div className="site-name">{site.name || '未命名目标'}</div>
                        <span className="site-url" onClick={() => window.open(site.url,'_blank')} title={site.url}>
                          {site.url}
                        </span>
                        <div className="site-tags">
                          <span className="site-tag">⏱️ {site.interval}s</span>
                          {site.last_checked && (
                            <span className="site-tag">🕒 {timeAgo(site.last_checked)}</span>
                          )}
                          {site.status==='error' && <span className="badge badge-error">✕ 错误</span>}
                          {site.last_checked && site.status==='idle' && <span className="badge badge-active">● 正常</span>}
                        </div>
                      </div>
                    </div>
                    <div className="site-actions">
                      <button className="btn-icon" onClick={() => checkNow(site.id)} title="立即检查" disabled={!!checking}>
                        ⚡
                      </button>
                      <button className="btn-icon danger" onClick={() => deleteSite(site.id)} title="删除">
                        🗑️
                      </button>
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
            <div className="change-list">
              {changes.length === 0
                ? <div className="empty-state">暂无捕捉到的变动信号</div>
                : changes.map(c => (
                  <div key={c.id} className="change-item">
                    <div className="change-icon">📢</div>
                    <div className="change-body">
                      <div className="change-row">
                        <span className="change-name">{c.site_name}</span>
                        <span className="change-time">{timeAgo(c.detected_at)}</span>
                      </div>
                      <div className="change-desc">{c.diff_summary}</div>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      </div>

      <footer>&copy; 2026 NanoMonitor 高级集群监视系统 v1.2.0</footer>
    </div>
  );
}
