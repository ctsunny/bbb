import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Bell, Plus, Trash2, RefreshCw, ShieldCheck,
  Clock, Globe, AlertCircle, Settings, Activity, 
  History, LogOut, Key, ExternalLink
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const API_BASE = 'http://localhost:3001/api';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken]           = useState(() => localStorage.getItem('access_token'));
  const [loginForm, setLoginForm]   = useState({ user: '', pass: '' });

  const [sites,   setSites]   = useState([]);
  const [changes, setChanges] = useState([]);
  const [barkKey, setBarkKey] = useState('');
  const [newSite, setNewSite] = useState({ url: '', name: '', interval: 60 });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(null);
  const [message, setMessage] = useState('');

  const headers = { Authorization: token };

  /* ---- 验证 Token ---- */
  useEffect(() => {
    if (!token) return;
    axios.get(`${API_BASE}/sites`, { headers })
      .then(() => { setIsLoggedIn(true); fetchData(); })
      .catch(handleLogout);
  }, []);

  /* ---- 自动刷新 ---- */
  useEffect(() => {
    if (!isLoggedIn) return;
    const t = setInterval(fetchData, 10000);
    return () => clearInterval(t);
  }, [isLoggedIn, token]);

  /* ---- 登录 ---- */
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/login`, loginForm);
      const tok = res.data.token;
      localStorage.setItem('access_token', tok);
      setToken(tok);
      setIsLoggedIn(true);
      fetchData(tok);
    } catch {
      alert('登录失败：用户名或密码错误');
    }
  };

  /* ---- 退出 ---- */
  const handleLogout = () => {
    localStorage.removeItem('access_token');
    setToken(null);
    setIsLoggedIn(false);
  };

  /* ---- 拉取数据 ---- */
  const fetchData = async (tok = token) => {
    const h = { Authorization: tok };
    try {
      const [sitesRes, changesRes, cfgRes] = await Promise.all([
        axios.get(`${API_BASE}/sites`,   { headers: h }),
        axios.get(`${API_BASE}/changes`, { headers: h }),
        axios.get(`${API_BASE}/config`,  { headers: h }),
      ]);
      setSites(sitesRes.data.sites);
      setChanges(changesRes.data.changes);
      setBarkKey(cfgRes.data.bark_key || '');
    } catch (e) {
      console.error(e);
    }
  };

  /* ---- 添加站点 ---- */
  const addSite = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/sites`, newSite, { headers });
      setNewSite({ url: '', name: '', interval: 60 });
      setMessage('监控目标已添加！');
      setTimeout(() => setMessage(''), 3000);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || '添加失败');
    } finally {
      setLoading(false);
    }
  };

  /* ---- 删除站点 ---- */
  const deleteSite = async (id) => {
    if (!confirm('确认删除该监控目标？')) return;
    await axios.delete(`${API_BASE}/sites/${id}`, { headers });
    fetchData();
  };

  /* ---- 立即检查 ---- */
  const checkNow = async (site) => {
    if (checking) return;
    setChecking(site.id);
    try {
      await axios.post(`${API_BASE}/check-now/${site.id}`, {}, { headers });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || '检查失败');
    } finally {
      setChecking(null);
    }
  };

  /* ---- 保存 Bark ---- */
  const saveBark = async () => {
    try {
      await axios.post(`${API_BASE}/settings`, { bark_key: barkKey }, { headers });
      alert('Bark 配置已保存！');
    } catch {
      alert('保存失败');
    }
  };

  const timeAgo = (dt) =>
    formatDistanceToNow(new Date(dt), { addSuffix: true, locale: zhCN });

  const statusIcon = (site) => {
    if (checking === site.id || site.status === 'checking')
      return <RefreshCw size={20} className="spin" />;
    return <Globe size={20} />;
  };

  /* ========== 登录页 ========== */
  if (!isLoggedIn) {
    return (
      <div className="login-page">
        <div className="glass-card login-card">
          <div className="login-header">
            <h1 className="login-title">
              <span className="login-title-icon"><Key size={20} color="#fff" /></span>
              管理后台
            </h1>
            <p className="login-sub">NanoMonitor Console</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">账号 (Username)</label>
              <input
                type="text"
                className="input-field"
                required
                value={loginForm.user}
                onChange={e => setLoginForm({ ...loginForm, user: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">密码 (Password)</label>
              <input
                type="password"
                className="input-field"
                required
                value={loginForm.pass}
                onChange={e => setLoginForm({ ...loginForm, pass: e.target.value })}
              />
            </div>
            <button type="submit" className="login-btn">确认登录</button>
          </form>

          <div className="login-footer">&copy; 2026 安全链路已加密 · NanoMonitor</div>
        </div>
      </div>
    );
  }

  /* ========== 主仪表盘 ========== */
  return (
    <div className="page">

      {/* 顶栏 */}
      <header className="glass-card header">
        <div>
          <div className="header-logo">
            <span className="header-icon"><Activity size={24} color="#fff" /></span>
            监控面板
            <span style={{ color: 'var(--primary)', fontWeight: 400, fontSize: 18 }}>控制台</span>
          </div>
          <div className="header-sub">
            <ShieldCheck size={14} color="var(--primary)" /> 安全会话进行中
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
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
            <LogOut size={14} /> 退出
          </button>
        </div>
      </header>

      {/* 消息 */}
      {message && <div className="message-bar fade-in">{message}</div>}

      {/* 主内容 */}
      <div className="main-grid">

        {/* ---- 左侧栏 ---- */}
        <div className="sidebar">

          {/* 新增探测目标 */}
          <div className="glass-card">
            <div className="card-header">
              <div className="card-header-title">
                <Plus size={16} /> 新增探测目标
              </div>
            </div>
            <div className="card-body">
              <form onSubmit={addSite}>
                <div className="form-group">
                  <label className="form-label">备注名称</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="例如：VPS 抢购页"
                    value={newSite.name}
                    onChange={e => setNewSite({ ...newSite, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">目标网址</label>
                  <input
                    type="url"
                    className="input-field"
                    placeholder="https://..."
                    required
                    value={newSite.url}
                    onChange={e => setNewSite({ ...newSite, url: e.target.value })}
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading
                    ? <RefreshCw size={16} className="spin" />
                    : <ShieldCheck size={16} />}
                  激活探测器
                </button>
              </form>
            </div>
          </div>

          {/* Bark 配置 */}
          <div className="glass-card">
            <div className="card-header">
              <div className="card-header-title">
                <Settings size={16} /> 推送配置
              </div>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Bark Token</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="输入你的 Bark Key"
                  value={barkKey}
                  onChange={e => setBarkKey(e.target.value)}
                />
              </div>
              <button className="save-btn" onClick={saveBark}>保存配置</button>
            </div>
          </div>

        </div>

        {/* ---- 右侧主区 ---- */}
        <div className="content">

          {/* 监控列表 */}
          <div className="glass-card">
            <div className="card-header">
              <div className="card-header-title">
                <Globe size={16} /> 监视中的资产 ({sites.length})
              </div>
              <button className="refresh-btn" onClick={fetchData} title="刷新">
                <RefreshCw size={15} />
              </button>
            </div>

            <div className="site-list">
              {sites.length === 0
                ? <div className="empty-state">暂无监控目标，请添加网址</div>
                : sites.map(site => (
                  <div key={site.id} className="site-item">
                    <div className="site-info">
                      <div className={`site-icon${site.status === 'checking' ? ' checking' : site.status === 'error' ? ' error' : ''}`}>
                        {statusIcon(site)}
                      </div>
                      <div className="site-meta">
                        <div className="site-name">{site.name || '未命名目标'}</div>
                        <span
                          className="site-url"
                          onClick={() => window.open(site.url, '_blank')}
                          title={site.url}
                        >
                          {site.url} <ExternalLink size={10} style={{ display: 'inline', verticalAlign: 'middle' }} />
                        </span>
                        <div className="site-tags">
                          <span className="site-tag">
                            <Clock size={9} /> {site.interval}s
                          </span>
                          {site.last_checked && (
                            <span className="site-tag">
                              <History size={9} /> {timeAgo(site.last_checked)}
                            </span>
                          )}
                          {site.status === 'error' && (
                            <span className="badge badge-error" title={site.error_message}>
                              ✕ 错误
                            </span>
                          )}
                          {site.last_checked && site.status === 'idle' && (
                            <span className="badge badge-active">● 正常</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="site-actions">
                      <button
                        className="btn-icon"
                        onClick={() => checkNow(site)}
                        title="立即检查"
                        disabled={!!checking}
                      >
                        {checking === site.id
                          ? <RefreshCw size={16} className="spin" />
                          : <Activity size={16} />}
                      </button>
                      <button
                        className="btn-icon danger"
                        onClick={() => deleteSite(site.id)}
                        title="删除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* 警报 Feed */}
          <div className="glass-card">
            <div className="card-header">
              <div className="card-header-title">
                <Bell size={16} /> 变动警报 Feed
              </div>
              <span className="badge badge-live">实时同步</span>
            </div>

            <div className="change-list">
              {changes.length === 0
                ? <div className="empty-state">暂无捕捉到的变动信号</div>
                : changes.map(c => (
                  <div key={c.id} className="change-item fade-in">
                    <div className="change-icon">
                      <AlertCircle size={16} />
                    </div>
                    <div className="change-body">
                      <div className="change-row">
                        <span className="change-name">{c.site_name}</span>
                        <span className="change-time">{timeAgo(c.detected_at)}</span>
                      </div>
                      <div className="change-desc">{c.diff_summary}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

        </div>
      </div>

      <footer>&copy; 2026 NanoMonitor 高级集群监视系统</footer>
    </div>
  );
}
