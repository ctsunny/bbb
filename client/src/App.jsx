import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Bell, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Database, 
  ShieldCheck, 
  Clock, 
  Globe, 
  AlertCircle,
  Settings,
  ChevronRight,
  Activity
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const sitesRes = await axios.get(`${API_BASE}/sites`);
      const changesRes = await axios.get(`${API_BASE}/changes`);
      const settingsRes = await axios.get(`${API_BASE}/settings`);
      
      setSites(sitesRes.data.sites);
      setChanges(changesRes.data.changes);
      
      const key = settingsRes.data.settings.find(s => s.key === 'bark_key')?.value || '';
      setBarkKey(key);
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
    } catch (err) {
      console.error('Error adding site:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteSite = async (id) => {
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
      console.error('Error checking site:', err);
    } finally {
      setChecking(null);
    }
  };

  const saveSettings = async () => {
    try {
      await axios.post(`${API_BASE}/settings`, { bark_key: barkKey });
      alert('Settings saved!');
    } catch (err) {
      console.error('Error saving settings:', err);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 glass-card p-6 border-l-4 border-l-primary-500">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 tracking-tight">
            <span className="bg-primary-500 p-2 rounded-lg"><Activity size={24} className="text-white" /></span>
            NanoMonitor <span className="text-primary-500">v1.0</span>
          </h1>
          <p className="text-dark-muted mt-2 text-sm flex items-center gap-2">
            Professional Web Monitoring & Alert System
          </p>
        </div>
        
        <div className="flex gap-4">
          <div className="text-right">
            <div className="text-xs text-dark-muted uppercase font-semibold">Active Monitors</div>
            <div className="text-2xl font-bold text-primary-400">{sites.length}</div>
          </div>
          <div className="w-px h-10 bg-dark-border self-center mx-2" />
          <div className="text-right">
            <div className="text-xs text-dark-muted uppercase font-semibold">Detected Changes</div>
            <div className="text-2xl font-bold text-primary-400">{changes.length}</div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: Controls & Stats */}
        <div className="space-y-8">
          {/* Add Site */}
          <section className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Plus size={20} className="text-primary-500" />
              <h2 className="font-semibold">Add New Target</h2>
            </div>
            <form onSubmit={addSite} className="space-y-4">
              <div>
                <label className="text-xs text-dark-muted block mb-1">Target Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. VPS Sale Page" 
                  className="input-field"
                  value={newSite.name}
                  onChange={e => setNewSite({...newSite, name: e.target.value})}
                />
              </div>
              <div>
                <label className="text-xs text-dark-muted block mb-1">URL Address</label>
                <input 
                  type="url" 
                  placeholder="https://..." 
                  className="input-field"
                  required
                  value={newSite.url}
                  onChange={e => setNewSite({...newSite, url: e.target.value})}
                />
              </div>
              <div>
                <label className="text-xs text-dark-muted block mb-1">Check Interval (sec)</label>
                <input 
                  type="number" 
                  className="input-field"
                  min="30"
                  value={newSite.interval}
                  onChange={e => setNewSite({...newSite, interval: e.target.value})}
                />
              </div>
              <button disabled={loading} className="btn-primary w-full mt-2">
                {loading ? <RefreshCw size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                Start Monitoring
              </button>
            </form>
          </section>

          {/* Settings */}
          <section className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Settings size={20} className="text-primary-500" />
              <h2 className="font-semibold">Configurations</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-dark-muted block mb-1 flex justify-between">
                  Bark Key 
                  <a href="https://github.com/Finb/Bark" target="_blank" className="text-primary-500 hover:underline">Download App</a>
                </label>
                <input 
                  type="password" 
                  className="input-field"
                  placeholder="Enter your Bark Token"
                  value={barkKey}
                  onChange={e => setBarkKey(e.target.value)}
                />
              </div>
              <button onClick={saveSettings} className="btn-primary w-full bg-dark-border text-white hover:bg-dark-muted">
                Save Settings
              </button>
            </div>
          </section>
        </div>

        {/* Center/Right: Target List & Changes */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Active Targets */}
          <section className="glass-card overflow-hidden">
            <div className="p-6 border-b border-dark-border flex justify-between items-center bg-dark-bg/40">
              <div className="flex items-center gap-2">
                <Globe size={20} className="text-primary-500" />
                <h2 className="font-semibold">Monitored Sites</h2>
              </div>
              <button 
                onClick={fetchData} 
                className="text-dark-muted hover:text-primary-500 p-1 rounded-md transition-colors"
              >
                <RefreshCw size={18} />
              </button>
            </div>
            
            <div className="divide-y divide-dark-border">
              {sites.length === 0 && (
                <div className="p-12 text-center text-dark-muted italic">
                  No targets added yet. Start by entering a URL.
                </div>
              )}
              {sites.map(site => (
                <div key={site.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:bg-primary-500/5 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center text-primary-500 group-hover:bg-primary-500 group-hover:text-white transition-all">
                      <Globe size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold flex items-center gap-2 tracking-wide">
                        {site.name}
                        {site.last_checked && <span className="bg-green-500/20 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full text-[10px]">ACTIVE</span>}
                      </h3>
                      <p className="text-xs text-dark-muted truncate max-w-xs">{site.url}</p>
                      <div className="flex items-center gap-4 mt-1 text-[10px] text-dark-muted uppercase font-bold tracking-widest">
                        <span className="flex items-center gap-1"><Clock size={10} /> {site.interval}s</span>
                        {site.last_checked && <span>Last: {formatDistanceToNow(new Date(site.last_checked), { addSuffix: true })}</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => checkNow(site.id)}
                      disabled={checking === site.id}
                      className="p-2 text-dark-muted hover:text-primary-500 hover:bg-primary-500/10 rounded-lg transition-all"
                      title="Check Now"
                    >
                      {checking === site.id ? <RefreshCw size={18} className="animate-spin" /> : <Activity size={18} />}
                    </button>
                    <button 
                      onClick={() => deleteSite(site.id)}
                      className="p-2 text-dark-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                    <a 
                      href={site.url} 
                      target="_blank" 
                      className="p-2 text-dark-muted hover:text-primary-500 hover:bg-primary-500/10 rounded-lg transition-all"
                      title="Visit Site"
                    >
                      <ChevronRight size={18} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Change Logs */}
          <section className="glass-card overflow-hidden">
            <div className="p-6 border-b border-dark-border flex items-center gap-2 bg-dark-bg/40">
              <Bell size={20} className="text-primary-500" />
              <h2 className="font-semibold">Recent Alerts</h2>
            </div>
            
            <div className="divide-y divide-dark-border">
              {changes.length === 0 && (
                <div className="p-12 text-center text-dark-muted italic">
                  History is clean. No changes detected yet.
                </div>
              )}
              <AnimatePresence>
                {changes.map(change => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={change.id} 
                    className="p-4 flex items-start gap-4 hover:bg-white/5 transition-colors border-l-2 border-transparent hover:border-l-primary-500"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-500 shrink-0">
                      <AlertCircle size={16} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-sm">{change.site_name}</h4>
                        <span className="text-[10px] text-dark-muted font-bold tracking-widest uppercase">
                          {formatDistanceToNow(new Date(change.detected_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-xs text-dark-muted mt-1 leading-relaxed">
                        Significant content update detected on the target page. Bark notification dispatched.
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>
        </div>

      </div>
      
      <footer className="text-center py-8 text-xs text-dark-muted font-bold tracking-[0.2em] uppercase opacity-50">
        &copy; 2024 Advanced Infrastructure Monitoring Systems
      </footer>
    </div>
  );
}

export default App;
