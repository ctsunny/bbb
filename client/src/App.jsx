import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Bell, Plus, Trash2, RefreshCw, ShieldCheck, Clock, 
  Globe, AlertCircle, Settings, ChevronRight, Activity, 
  History, Info, LogOut, Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

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
      alert('Invalid login credentials');
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('access_token');
    setIsLoggedIn(false);
  };

  const fetchData = async () => {
    try {
      const sitesRes = await axios.get(`${API_BASE}/sites`, { headers: { Authorization: token } });
      const changesRes = await axios.get(`${API_BASE}/changes`, { headers: { Authorization: token } });
      setSites(sitesRes.data.sites);
      setChanges(changesRes.data.changes);
    } catch (err) {
      console.error(err);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 selection:bg-primary-500/30">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass-card w-full max-w-md p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full -mr-16 -mt-16 blur-2xl" />
          <header className="mb-8 text-center">
            <h1 className="text-3xl font-black text-white flex items-center justify-center gap-2">
              <span className="bg-primary-500 p-2 rounded-lg"><Key size={20} /></span>
              NanoMonitor Console
            </h1>
            <p className="text-dark-muted mt-2 text-sm">Enter your credentials to manage infrastructure</p>
          </header>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="text-xs uppercase font-bold text-dark-muted tracking-[0.2em] mb-2 block">Username</label>
              <input type="text" className="input-field" required value={loginForm.user} onChange={e => setLoginForm({...loginForm, user: e.target.value})} />
            </div>
            <div>
              <label className="text-xs uppercase font-bold text-dark-muted tracking-[0.2em] mb-2 block">Password</label>
              <input type="password" className="input-field" required value={loginForm.pass} onChange={e => setLoginForm({...loginForm, pass: e.target.value})} />
            </div>
            <button className="btn-primary w-full font-black py-3 bg-primary-600 hover:scale-105">ACCESS CONSOLE</button>
          </form>
          <footer className="mt-8 text-center text-[10px] text-dark-muted font-black tracking-[0.2em] uppercase opacity-30">
            &copy; 2026 Nanomonitor High-Security Uplink
          </footer>
        </motion.div>
      </div>
    );
  }

  // Dashboard UI (Previous premium design)
  return (
    <div className="min-h-screen p-4 md:p-8 space-y-8 max-w-7xl mx-auto selection:bg-primary-500/20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 glass-card p-6 border-l-4 border-l-primary-500 relative overflow-hidden">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-3 tracking-tighter text-white">
            <span className="bg-primary-500 p-2 rounded-lg text-white"><Activity size={24} /></span>
            NanoMonitor <span className="text-primary-500 font-normal opacity-70 italic">Admin Console</span>
          </h1>
          <p className="text-dark-muted mt-2 text-sm flex items-center gap-2">
            <ShieldCheck size={14} className="text-primary-400" /> Secure Terminal Session Active
          </p>
        </div>
        <button onClick={handleLogout} className="text-xs text-red-400 hover:text-white flex items-center gap-2 font-black tracking-widest uppercase transition-all">
          <LogOut size={16} /> End Session
        </button>
      </header>
      
      {/* Rest of Dashboard code same as before but adding Auth headers */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-8">
          <section className="glass-card p-6">
             <div className="flex items-center gap-2 mb-6"><Plus size={20} className="text-primary-500" /><h2 className="font-bold tracking-wide">NEW PROBE</h2></div>
             <form onSubmit={async (e) => {
               e.preventDefault();
               setLoading(true);
               try {
                 await axios.post(`${API_BASE}/sites`, newSite, { headers: { Authorization: token } });
                 setNewSite({ url: '', name: '', interval: 60 });
                 fetchData();
               } catch (err) { alert('Action Failed'); }
               setLoading(false);
             }} className="space-y-4">
                <input type="text" placeholder="Alias Name" className="input-field" value={newSite.name} onChange={e => setNewSite({...newSite, name: e.target.value})} />
                <input type="url" placeholder="https://..." className="input-field" required value={newSite.url} onChange={e => setNewSite({...newSite, url: e.target.value})} />
                <button disabled={loading} className="btn-primary w-full font-bold">ACTIVATE</button>
             </form>
          </section>
        </div>

        <div className="lg:col-span-3 space-y-8">
          <section className="glass-card">
            <div className="p-6 border-b border-white/5 bg-white/2 font-bold flex justify-between uppercase text-xs tracking-widest items-center text-dark-muted">
              Active Targets 
              <button onClick={fetchData} className="hover:text-white"><RefreshCw size={14} /></button>
            </div>
            <div className="divide-y divide-white/5">
              {sites.map(site => (
                <div key={site.id} className="p-5 flex justify-between items-center group">
                  <div>
                    <h3 className="font-black text-white group-hover:text-primary-500 transition-colors uppercase">{site.name}</h3>
                    <p className="text-[10px] text-dark-muted font-bold truncate max-w-xs">{site.url}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={async () => {
                      try { await axios.post(`${API_BASE}/check-now/${site.id}`, {}, { headers: { Authorization: token } }); fetchData(); }
                      catch(e) { alert('Busy'); }
                    }} className="p-2 bg-white/5 rounded-lg hover:bg-primary-500 text-white transition-all"><Activity size={16} /></button>
                    <button onClick={async () => {
                      if(confirm('Delete?')) { await axios.delete(`${API_BASE}/sites/${site.id}`, { headers: { Authorization: token } }); fetchData(); }
                    }} className="p-2 bg-white/5 rounded-lg hover:bg-red-500 text-white transition-all"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-card max-h-[400px] overflow-y-auto">
             <div className="p-6 border-b border-white/5 bg-white/2 font-bold uppercase text-xs tracking-widest text-dark-muted">Signal Feed</div>
             {changes.map(c => (
               <div key={c.id} className="p-4 border-l-2 border-primary-500 hover:bg-white/5 transition-all">
                  <div className="flex justify-between font-bold text-[11px] mb-1">
                    <span className="text-white uppercase">{c.site_name}</span>
                    <span className="text-dark-muted tracking-tighter">{formatDistanceToNow(new Date(c.detected_at), { addSuffix: true })}</span>
                  </div>
                  <p className="text-xs text-dark-muted italic">{c.diff_summary}</p>
               </div>
             ))}
          </section>
        </div>
      </div>
    </div>
  );
}

export default App;
