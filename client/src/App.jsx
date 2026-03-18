import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

// Simple SVG icons (no lucide dependency needed)
const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const IcoActivity   = () => <Icon d="M22 12h-4l-3 9L9 3l-3 9H2" />;
const IcoKey        = () => <Icon d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />;
const IcoPlus       = () => <Icon d="M12 5v14M5 12h14" />;
const IcoSettings   = () => <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />;
const IcoGlobe      = () => <Icon d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />;
const IcoBell       = () => <Icon d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />;
const IcoRefresh    = () => <Icon d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />;
const IcoTrash      = () => <Icon d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />;
const IcoActivity2  = () => <Icon d="M22 12h-4l-3 9L9 3l-3 9H2" />;
const IcoAlert      = () => <Icon d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />;
const IcoLogout     = () => <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />;
const IcoShield     = () => <Icon d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />;
const IcoClock      = () => <Icon d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM12 6v6l4 2" />;
const IcoHistory    = () => <Icon d="M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8" />;
const IcoExternal   = () => <Icon d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />;

// Simple time ago (no date-fns needed)
const timeAgo = (dt) => {
  const diff = Date.now() - new Date(dt).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken]           = useState(() => localStorage.getItem('access_token'));
  const [loginForm, setLoginForm]   = useState({ user: '', pass: '' });
  const [sites,    setSites]        = useState([]);
  const [changes,  setChanges]      = useState([]);
  const [barkKey,  setBarkKey]      = useState('');
  const [newSite,  setNewSite]      = useState({ url: '', name: '', interval: 60 });
  const [loading,  setLoading]      = useState(false);
  const [checking, setChecking]     = useState(null);
  const [message,  setMessage]      = useState('');

  const authHeader = token ? { Authorization: token } : {};

  const fetchData = useCallback(async (tok = token) => {
    const h = { Authorization: tok };
    try {
      const [s, c, cfg] = await Promise.all([
        axios.get(`${API_BASE}/sites`,   { headers: h }),
        axios.get(`${API_BASE}/changes`, { headers: h }),
        axios.get(`${API_BASE}/config`,  { headers: h }),
      ]);
      setSites(s.data.sites);
      setChanges(c.data.changes);
      setBarkKey(cfg.data.bark_key || '');
    } catch(e) { console.error(e); }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    axios.get(`${API_BASE}/sites`, { headers: { Authorization: token } })
      .then(() => { setIsLoggedIn(true); fetchData(); })
      .catch(() => { localStorage.removeItem('access_token'); setToken(null); });
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    const t = setInterval(() => fetchData(), 10000);
    return () => clearInterval(t);
  }, [isLoggedIn, fetchData]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/login`, loginForm);
      const tok = res.data.token;
      localStorage.setItem('access_token', tok);
      setToken(tok);
      setIsLoggedIn(true);
      fetchData(tok);
    } catch { alert('登录失败：用户名或密码错误'); }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    setToken(null); setIsLoggedIn(false);
  };

  const addSite = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/sites`, newSite, { headers: authHeader });
      setNewSite({ url: '', name: '', interval: 60 });
      setMessage('监控目标已添加！');
      setTimeout(() => setMessage(''), 3000);
      fetchData();
    } catch (err) { alert(err.response?.data?.error || '添加失败'); }
    setLoading(false);
  };

  const deleteSite = async (id) => {
    if (!confirm('确认删除该监控目标？')) return;
    await axios.delete(`${API_BASE}/sites/${id}`, { headers: authHeader });
    fetchData();
  };

  const checkNow = async (id) => {
    setChecking(id);
    try {
      await axios.post(`${API_BASE}/check-now/${id}`, {}, { headers: authHeader });
      fetchData();
    } catch (err) { alert(err.response?.data?.error || '检查失败'); }
    setChecking(null);
  };

  const saveBark = async () => {
    try {
      await axios.post(`${API_BASE}/settings`, { bark_key: barkKey }, { headers: authHeader });
      alert('Bark 配置已保存！');
    } catch { alert('保存失败'); }
  };

  /* ========== 登录页 ========== */
  if (!isLoggedIn) return (
    <div className="login-page">
      <div className="glass-card login-card">
        <div className="login-header">
          <h1 className="login-title">
            <span className="login-title-icon"><IcoKey /></span>
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
            <span className="header-icon"><IcoActivity /></span>
            监控面板
            <span style={{color:'var(--primary)',fontWeight:400,fontSize:18,fontStyle:'italic'}}>控制台</span>
          </div>
          <div className="header-sub">
            <IcoShield size={14} /><span>安全会话进行中</span>
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
            <IcoLogout size={14} /> 退出
          </button>
        </div>
      </header>

      {message && <div className="message-bar">{message}</div>}

      <div className="main-grid">
        {/* 左侧栏 */}
        <div className="sidebar">
          <div className="glass-card">
            <div className="card-header">
              <div className="card-header-title"><IcoPlus size={16} /> 新增探测目标</div>
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
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? <span className="spin" style={{display:'inline-block'}}>⟳</span> : <IcoShield size={16} />}
                  激活探测器
                </button>
              </form>
            </div>
          </div>

          <div className="glass-card">
            <div className="card-header">
              <div className="card-header-title"><IcoSettings size={16} /> 推送配置</div>
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
              <div className="card-header-title"><IcoGlobe size={16} /> 监视中的资产 ({sites.length})</div>
              <button className="refresh-btn" onClick={() => fetchData()} title="刷新"><IcoRefresh size={15} /></button>
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
                          : <IcoGlobe size={20} />}
                      </div>
                      <div className="site-meta">
                        <div className="site-name">{site.name || '未命名目标'}</div>
                        <span className="site-url" onClick={() => window.open(site.url,'_blank')} title={site.url}>
                          {site.url}
                        </span>
                        <div className="site-tags">
                          <span className="site-tag"><IcoClock size={9} /> {site.interval}s</span>
                          {site.last_checked && (
                            <span className="site-tag"><IcoHistory size={9} /> {timeAgo(site.last_checked)}</span>
                          )}
                          {site.status==='error' && <span className="badge badge-error">✕ 错误</span>}
                          {site.last_checked && site.status==='idle' && <span className="badge badge-active">● 正常</span>}
                        </div>
                      </div>
                    </div>
                    <div className="site-actions">
                      <button className="btn-icon" onClick={() => checkNow(site.id)} title="立即检查" disabled={!!checking}>
                        <IcoActivity2 size={16} />
                      </button>
                      <button className="btn-icon danger" onClick={() => deleteSite(site.id)} title="删除">
                        <IcoTrash size={16} />
                      </button>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>

          <div className="glass-card">
            <div className="card-header">
              <div className="card-header-title"><IcoBell size={16} /> 变动警报 Feed</div>
              <span className="badge badge-live">实时同步</span>
            </div>
            <div className="change-list">
              {changes.length === 0
                ? <div className="empty-state">暂无捕捉到的变动信号</div>
                : changes.map(c => (
                  <div key={c.id} className="change-item">
                    <div className="change-icon"><IcoAlert size={16} /></div>
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

      <footer>&copy; 2026 NanoMonitor 高级集群监视系统</footer>
    </div>
  );
}
