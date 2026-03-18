import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Bell, Plus, Trash2, RefreshCw, ShieldCheck, Clock, 
  Globe, AlertCircle, Settings, ChevronRight, Activity, 
  History, Info, LogOut, Key, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const API_BASE = 'http://localhost:3001/api';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('access_token'));
  const [loginForm, setLoginForm] = useState({ user: '', pass: '' });
  
  const [sites, setSites] = useState([]);
  const [changes, setChanges] = useState([]);
  const [barkKey, setBarkKey] = useState('');
  const [newSite, setNewSite] = useState({ url: '', name: '', interval: 60 });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (token) {
      validateToken();
    }
  }, [token]);

  const validateToken = async () => {
    try {
      await axios.get(`${API_BASE}/sites`, { headers: { Authorization: token } });
      setIsLoggedIn(true);
      fetchData();
      const interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);
    } catch (err) {
      handleLogout();
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/login`, loginForm);
      setToken(res.data.token);
      localStorage.setItem('access_token', res.data.token);
      setIsLoggedIn(true);
    } catch (err) {
      alert('登录失败：用户名或密码错误');
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('access_token');
    setIsLoggedIn(false);
  };

  const fetchData = async () => {
    try {
      const configRes = await axios.get(`${API_BASE}/config`, { headers: { Authorization: token } });
      const sitesRes = await axios.get(`${API_BASE}/sites`, { headers: { Authorization: token } });
      const changesRes = await axios.get(`${API_BASE}/changes`, { headers: { Authorization: token } });
      
      setBarkKey(configRes.data.bark_key || '');
      setSites(sitesRes.data.sites);
      setChanges(changesRes.data.changes);
    } catch (err) {
      console.error(err);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 selection:bg-blue-500/30">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass-card w-full max-w-md p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full -mr-16 -mt-16 blur-2xl" />
          <header className="mb-8 text-center">
            <h1 className="text-3xl font-black text-white flex items-center justify-center gap-2">
              <span className="bg-primary-500 p-2 rounded-lg text-white"><Key size={20} /></span>
              管理后台
            </h1>
            <p className="text-dark-muted mt-2 text-sm tracking-widest uppercase opacity-60">NanoMonitor Console</p>
          </header>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="text-xs font-bold text-dark-muted mb-2 block uppercase tracking-widest">账号 (Username)</label>
              <input type="text" className="input-field" required value={loginForm.user} onChange={e => setLoginForm({...loginForm, user: e.target.value})} />
            </div>
            <div>
              <label className="text-xs font-bold text-dark-muted mb-2 block uppercase tracking-widest">密码 (Password)</label>
              <input type="password" className="input-field" required value={loginForm.pass} onChange={e => setLoginForm({...loginForm, pass: e.target.value})} />
            </div>
            <button className="btn-primary w-full font-black py-4 bg-primary-600 hover:scale-[1.02] active:scale-95 transition-all">确认登录</button>
          </form>
          <footer className="mt-8 text-center text-[10px] text-dark-muted font-bold tracking-[0.2em] uppercase opacity-30">
            &copy; 2026 安全链路已加密
          </footer>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-8 max-w-7xl mx-auto selection:bg-primary-500/20">
      {/* 顶部标题栏 */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 glass-card p-6 border-l-4 border-l-primary-500 relative overflow-hidden">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-3 tracking-tighter text-white">
            <span className="bg-primary-500 p-2 rounded-lg text-white"><Activity size={24} /></span>
            监控面板 <span className="text-primary-500 font-normal opacity-70 italic">控制台</span>
          </h1>
          <p className="text-dark-muted mt-2 text-sm flex items-center gap-2">
            <ShieldCheck size={14} className="text-primary-400" /> 安全会话进行中
          </p>
        </div>
        <div className="flex items-center gap-4">
           <button onClick={handleLogout} className="text-xs text-red-400 hover:text-white flex items-center gap-2 font-black tracking-widest uppercase transition-all bg-red-400/5 px-4 py-2 rounded-lg border border-red-500/10">
             <LogOut size={16} /> 结束会话
           </button>
        </div>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* 左侧控制栏 */}
        <div className="lg:col-span-1 space-y-8">
          {/* 添加监控 */}
          <section className="glass-card p-6">
             <div className="flex items-center gap-2 mb-6"><Plus size={20} className="text-primary-500" /><h2 className="font-bold tracking-brand">新增探测目标</h2></div>
             <form onSubmit={async (e) => {
               e.preventDefault();
               setLoading(true);
               try {
                 await axios.post(`${API_BASE}/sites`, newSite, { headers: { Authorization: token } });
                 setNewSite({ url: '', name: '', interval: 60 });
                 fetchData();
               } catch (err) { alert('操作失败'); }
               setLoading(false);
             }} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-dark-muted uppercase mb-1 ml-1 block">目标备注</label>
                  <input type="text" placeholder="例如：VPS 抢购页" className="input-field" value={newSite.name} onChange={e => setNewSite({...newSite, name: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-dark-muted uppercase mb-1 ml-1 block">网址 (URL)</label>
                  <input type="url" placeholder="https://..." className="input-field" required value={newSite.url} onChange={e => setNewSite({...newSite, url: e.target.value})} />
                </div>
                <button disabled={loading} className="btn-primary w-full font-black py-3 text-sm tracking-widest">激活探测器</button>
             </form>
          </section>

          {/* 系统设置 */}
          <section className="glass-card p-6">
             <div className="flex items-center gap-2 mb-6"><Settings size={20} className="text-primary-500" /><h2 className="font-bold tracking-brand">系统同步配置</h2></div>
             <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-dark-muted uppercase mb-1 ml-1 block">Bark 推送 Key</label>
                  <input type="password" className="input-field" value={barkKey} onChange={e => setBarkKey(e.target.value)} />
                </div>
                <button onClick={async () => {
                  try {
                    await axios.post(`${API_BASE}/settings`, { bark_key: barkKey }, { headers: { Authorization: token } });
                    alert('配置已同步');
                  } catch(e) { alert('更新失败'); }
                }} className="w-full bg-slate-800 border border-slate-700 py-2.5 text-xs font-black tracking-widest uppercase rounded-lg hover:bg-slate-700 transition-all text-dark-muted hover:text-white">保存配置</button>
             </div>
          </section>
        </div>

        {/* 右侧主栏 */}
        <div className="lg:col-span-3 space-y-8">
          
          {/* 监控列表 */}
          <section className="glass-card">
            <div className="p-6 border-b border-white/5 bg-white/2 flex justify-between items-center">
              <div className="flex items-center gap-2 font-black uppercase text-xs tracking-widest text-dark-muted">
                <Globe size={18} className="text-primary-400" /> 监视中的资产 ({sites.length})
              </div>
              <button onClick={fetchData} className="text-dark-muted hover:text-white transition-colors"><RefreshCw size={16} /></button>
            </div>
            <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
              {sites.length === 0 && (
                <div className="p-20 text-center text-dark-muted font-bold tracking-[0.3em] uppercase opacity-20 italic">空位以待，请添加监控网址</div>
              )}
              {sites.map(site => (
                <div key={site.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:bg-white/[0.02] transition-colors relative transition-all">
                  <div className="flex items-start gap-5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-2xl border ${
                      site.status === 'checking' ? 'bg-primary-500/10 border-primary-500 animate-pulse' : 
                      site.status === 'error' ? 'bg-red-500/10 border-red-500' : 'bg-white/5 border-transparent'
                    }`}>
                      {site.status === 'checking' ? <RefreshCw className="animate-spin text-primary-400" /> : <Globe className="text-white/20" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black text-white text-lg group-hover:text-primary-400 transition-colors tracking-tight uppercase leading-none mb-2">{site.name || '未命名目标'}</h3>
                      <div className="flex items-center gap-2 text-[10px] text-dark-muted font-black tracking-widest uppercase mb-2">
                        <span className="bg-white/5 px-2 py-0.5 rounded flex items-center gap-1"><Clock size={10} /> {site.interval}s</span>
                        {site.last_checked && (
                           <span className="flex items-center gap-1"><History size={10} /> 上次检查: {formatDistanceToNow(new Date(site.last_checked), { addSuffix: true, locale: zhCN })}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-primary-500/60 font-medium truncate max-w-sm hover:text-primary-400 cursor-pointer flex items-center gap-1" onClick={() => window.open(site.url, '_blank')}>
                        {site.url} <ExternalLink size={10} />
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={async () => {
                        try { await axios.post(`${API_BASE}/check-now/${site.id}`, {}, { headers: { Authorization: token } }); fetchData(); }
                        catch(e) { alert('服务器繁忙'); }
                      }}
                      className="p-3 bg-white/5 rounded-xl hover:bg-primary-500 hover:text-white transition-all shadow-lg active:scale-90"
                    >
                      <Activity size={18} />
                    </button>
                    <button 
                      onClick={async () => {
                        if(confirm('强制删除该监控目标？')) { 
                          await axios.delete(`${API_BASE}/sites/${site.id}`, { headers: { Authorization: token } }); 
                          fetchData(); 
                        }
                      }}
                      className="p-3 bg-white/5 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-transparent hover:border-red-400/50"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 实时动态 */}
          <section className="glass-card">
            <div className="p-6 border-b border-white/5 bg-white/2 flex items-center justify-between">
              <div className="flex items-center gap-2 font-black uppercase text-xs tracking-widest text-dark-muted">
                 <Bell size={18} className="text-primary-400" /> 警报 Feed (变动历史)
              </div>
              <span className="text-[9px] font-black bg-primary-500/10 text-primary-400 px-3 py-1 rounded-full uppercase tracking-tighter">实时同步</span>
            </div>
            <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
              {changes.length === 0 && (
                <div className="p-16 text-center text-dark-muted uppercase font-bold tracking-[0.2em] opacity-10 italic">暂无捕捉到的变动信号</div>
              )}
              {changes.map(c => (
                <motion.div initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} key={c.id} className="p-5 flex items-start gap-4 hover:bg-white/[0.02] border-l-2 border-transparent hover:border-primary-500 transition-all">
                  <div className="w-9 h-9 rounded-full border border-primary-500/20 bg-primary-500/5 flex items-center justify-center text-primary-400 shadow-inner shrink-0">
                    <AlertCircle size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-black text-sm text-white/90 uppercase tracking-tight">{c.site_name}</h4>
                      <span className="text-[9px] text-dark-muted font-bold tracking-tighter uppercase ml-2 tabular-nums">
                        {formatDistanceToNow(new Date(c.detected_at), { addSuffix: true, locale: zhCN })}
                      </span>
                    </div>
                    <p className="text-xs text-dark-muted font-medium leading-relaxed italic opacity-80">
                       {c.diff_summary}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        </div>

      </div>
      
      <footer className="text-center py-10 text-[10px] text-dark-muted font-black tracking-[0.4em] uppercase opacity-40">
        &copy; 2026 NanoMonitor Infrastructure | 高级集群监视系统
      </footer>
    </div>
  );
}

export default App;
