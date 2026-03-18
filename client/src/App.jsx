import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Bell, 
  Plus, 
  Trash2, 
  RefreshCw, 
  ShieldCheck, 
  Clock, 
  Globe, 
  AlertCircle,
  Settings,
  ChevronRight,
  Activity,
  History,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

const API_BASE = 'http://localhost:3001/api';

function App() {
  const [sites, setSites] = useState([]);
  const [changes, setChanges] = useState([]);
  const [barkKey, setBarkKey] = useState('');
  const [newSite, setNewSite] = useState({ url: '', name: '', interval: 60 });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 10000); // 10s auto-refresh Dashboard
    return () => clearInterval(timer);
  }, []);

  const fetchData = async () => {
    try {
      const [sitesRes, changesRes, settingsRes] = await Promise.all([
        axios.get(`${API_BASE}/sites`),
        axios.get(`${API_BASE}/changes`),
        axios.get(`${API_BASE}/settings`)
      ]);
      
      setSites(sitesRes.data.sites);
      setChanges(changesRes.data.changes);
      setBarkKey(settingsRes.data.settings.find(s => s.key === 'bark_key')?.value || '');
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  const addSite = async (e) => {
    e.preventDefault();
    if (!newSite.url) return;
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/sites`, newSite);
      setNewSite({ url: '', name: '', interval: 60 });
      fetchData();
      setMessage('New site added successfully!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add site');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const deleteSite = async (id) => {
    if(!confirm('Delete this monitor?')) return;
    try {
      await axios.delete(`${API_BASE}/sites/${id}`);
      fetchData();
    } catch (err) {
      console.error('Error deleting site:', err);
    }
  };

  const checkNow = async (id) => {
    setChecking(id);
    try {
      await axios.post(`${API_BASE}/check-now/${id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Check failed');
    } finally {
      setChecking(null);
    }
  };

  const saveSettings = async () => {
    try {
       await axios.post(`${API_BASE}/settings`, { bark_key: barkKey });
       alert('Bark Key updated!');
    } catch (err) {
       alert(err.response?.data?.error || 'Invalid key');
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-8 max-w-7xl mx-auto selection:bg-primary-500/20">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 glass-card p-6 border-l-4 border-l-primary-500 relative overflow-hidden">
        <div className="z-10">
          <h1 className="text-3xl font-extrabold flex items-center gap-3 tracking-tighter">
            <span className="bg-primary-500 p-2 rounded-lg text-white"><Activity size={24} /></span>
            NanoMonitor <span className="text-primary-500/80 font-normal">v1.1</span>
          </h1>
          <p className="text-dark-muted mt-2 text-sm flex items-center gap-2">
            <ShieldCheck size={14} className="text-primary-400" />
            Active Infrastructure Surveillance
          </p>
        </div>
        
        <div className="flex gap-8 z-10 w-full md:w-auto justify-between md:justify-end">
          <div className="text-right">
            <div className="text-[10px] text-dark-muted uppercase font-bold tracking-widest mb-1">Targets</div>
            <div className="text-3xl font-black text-white">{sites.length}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-dark-muted uppercase font-bold tracking-widest mb-1">Total Signals</div>
            <div className="text-3xl font-black text-white">{changes.length}</div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
      </header>

      {message && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-primary-500/10 border border-primary-500/30 text-primary-400 p-4 rounded-xl text-center text-sm font-medium">
          {message}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Sidebar */}
        <div className="lg:col-span-1 space-y-8">
          {/* Add Site */}
          <section className="glass-card p-6">
            <div className="flex items-center gap-2 mb-6">
              <Plus size={20} className="text-primary-500" />
              <h2 className="font-bold tracking-wide">NEW PROBE</h2>
            </div>
            <form onSubmit={addSite} className="space-y-4">
              <div>
                <label className="text-[10px] text-dark-muted uppercase font-bold block mb-1.5 ml-1">Alias Name</label>
                <input type="text" placeholder="e.g. VPS Stock" className="input-field" value={newSite.name} onChange={e => setNewSite({...newSite, name: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] text-dark-muted uppercase font-bold block mb-1.5 ml-1">Target URL</label>
                <input type="url" placeholder="https://..." className="input-field border-primary-500/20" required value={newSite.url} onChange={e => setNewSite({...newSite, url: e.target.value})} />
              </div>
              <button disabled={loading} className="btn-primary w-full mt-2 font-bold py-3 shadow-lg shadow-primary-500/10">
                {loading ? <RefreshCw size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                ACTIVATE PROBE
              </button>
            </form>
          </section>

          {/* Settings */}
          <section className="glass-card p-6">
            <div className="flex items-center gap-2 mb-6">
              <Settings size={20} className="text-primary-500" />
              <h2 className="font-bold tracking-wide">PULSE SYNC</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-dark-muted uppercase font-bold block mb-1.5 ml-1">Bark Token</label>
                <input type="password" className="input-field" value={barkKey} onChange={e => setBarkKey(e.target.value)} />
              </div>
              <button onClick={saveSettings} className="w-full bg-dark-bg/60 border border-dark-border py-2 text-sm rounded-lg hover:bg-dark-border transition-colors uppercase font-bold tracking-widest">
                Save Pulse
              </button>
            </div>
          </section>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-8">
          
          {/* Active Targets */}
          <section className="glass-card">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/2">
              <div className="flex items-center gap-2 font-bold tracking-wide uppercase text-sm">
                <Globe size={18} className="text-primary-500" /> Monitored Assets
              </div>
              <button onClick={fetchData} className="text-dark-muted hover:text-white transition-colors"><RefreshCw size={16} /></button>
            </div>
            
            <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
              {sites.length === 0 && (
                <div className="p-16 text-center text-dark-muted font-medium opacity-10 uppercase tracking-widest italic">Signal Lost. Add a URL to begin.</div>
              )}
              {sites.map(site => (
                <div key={site.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 group transition-all hover:bg-primary-500/5">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg border-2 ${
                      site.status === 'checking' ? 'bg-primary-500/20 border-primary-500 animate-pulse' : 
                      site.status === 'error' ? 'bg-red-500/20 border-red-500' : 
                      'bg-white/5 border-transparent'
                    }`}>
                      {site.status === 'checking' ? <RefreshCw className="animate-spin text-primary-500" /> : <Globe className="text-white/40" />}
                    </div>
                    <div className="min-w-0 max-w-sm">
                      <h3 className="font-black text-lg truncate group-hover:text-primary-400 transition-colors uppercase tracking-wide">{site.name || 'Anonymous Target'}</h3>
                      <button onClick={() => window.open(site.url, '_blank')} className="text-[11px] text-primary-500/80 font-bold hover:underline block truncate mb-1 uppercase tracking-widest">{new URL(site.url).hostname}</button>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="flex items-center gap-1 text-[10px] font-black uppercase bg-white/5 px-2 py-0.5 rounded text-dark-muted"><Clock size={10} /> 5M</span>
                        {site.last_checked && (
                           <span className="text-[10px] font-bold uppercase text-dark-muted">Last sync: {formatDistanceToNow(new Date(site.last_checked), { addSuffix: true })}</span>
                        )}
                        {site.status === 'error' && (
                           <div className="group relative">
                             <span className="text-[10px] font-bold text-red-400 flex items-center gap-1 cursor-help"><Info size={10} /> Sync Error</span>
                             <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-red-950/90 text-red-200 border border-red-500/30 p-2 rounded text-[10px] z-50 w-48 shadow-2xl">{site.error_message}</div>
                           </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => checkNow(site.id)}
                      disabled={checking === site.id}
                      className="p-3 bg-white/5 rounded-xl hover:bg-primary-500 hover:text-white transition-all active:scale-90"
                    >
                      <Activity size={18} />
                    </button>
                    <button 
                      onClick={() => deleteSite(site.id)}
                      className="p-3 bg-white/5 rounded-xl hover:bg-red-500/80 text-dark-muted hover:text-white transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Change Logs */}
          <section className="glass-card">
            <div className="p-6 border-b border-white/5 bg-white/2 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold tracking-wide uppercase text-sm">
                 <History size={18} className="text-primary-500" /> Alert Feed
              </div>
              <span className="text-[10px] font-black bg-white/5 px-3 py-1 rounded text-dark-muted uppercase tracking-widest">Realtime Uplink</span>
            </div>
            
            <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
              {changes.length === 0 && (
                <div className="p-16 text-center text-dark-muted uppercase tracking-widest opacity-20 italic">Awaiting first signal shift...</div>
              )}
              {changes.map(change => (
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={change.id} className="p-5 flex items-start gap-4 hover:bg-white/5 group border-l-4 border-transparent hover:border-primary-500 transition-all">
                  <div className="w-10 h-10 rounded-full border-2 border-primary-500/20 bg-primary-500/10 flex items-center justify-center text-primary-400 group-hover:bg-primary-500 group-hover:text-white transition-all shadow-[0_0_15px_rgba(14,165,233,0.1)]">
                    <Bell size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-black text-sm uppercase tracking-wider">{change.site_name}</h4>
                      <span className="text-[10px] text-dark-muted font-bold tracking-tighter uppercase whitespace-nowrap ml-2">
                        {formatDistanceToNow(new Date(change.detected_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-dark-muted leading-relaxed font-medium">
                       {change.diff_summary}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        </div>

      </div>
      
      <footer className="text-center py-12 text-[10px] text-dark-muted font-black tracking-[0.4em] uppercase opacity-40">
        &copy; 2026 NanoMonitor Labs | End-to-End Encryption Enabled
      </footer>
    </div>
  );
}

export default App;
