const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const db = require('./db');
const { runMonitor, checkSite } = require('./monitor');
require('dotenv').config();

const app = express();
// Optimization 7: Environment variables
const PORT = process.env.PORT || 3001;
const CHECK_INTERVAL = process.env.CHECK_INTERVAL || '*/5 * * * *'; // Default 5 mins

app.use(cors());
app.use(express.json());

// API Endpoints
// --- Sites ---
app.get('/api/sites', (req, res) => {
  const sites = db.prepare('SELECT * FROM sites ORDER BY last_checked DESC').all();
  res.json({ sites });
});

app.post('/api/sites', (req, res) => {
  const { url, name, interval } = req.body;
  
  if (!url || !url.startsWith('http')) {
    return res.status(400).json({ error: 'Valid URL (with http/https) is required' });
  }

  try {
    const info = db.prepare('INSERT INTO sites (url, name, interval) VALUES (?, ?, ?)')
      .run(url, name || url, interval || 60);
    res.json({ id: info.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: 'Database error: ' + error.message });
  }
});

app.delete('/api/sites/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM sites WHERE id = ?').run(id);
  res.json({ success: true });
});

app.post('/api/check-now/:id', async (req, res) => {
  const { id } = req.params;
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(id);
  if (site) {
    if (site.status === 'checking') return res.status(400).json({ error: 'Check already in progress' });
    await checkSite(site);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Site not found' });
  }
});

// --- Changes ---
app.get('/api/changes', (req, res) => {
  const changes = db.prepare(`
    SELECT changes.*, sites.name as site_name, sites.url as site_url 
    FROM changes 
    JOIN sites ON changes.site_id = sites.id 
    ORDER BY detected_at DESC 
    LIMIT 100
  `).all();
  res.json({ changes });
});

// --- Settings ---
app.get('/api/settings', (req, res) => {
  const settings = db.prepare('SELECT * FROM settings').all();
  res.json({ settings });
});

app.post('/api/settings', (req, res) => {
  const { bark_key } = req.body;
  if (!bark_key || bark_key.length < 5) {
    return res.status(400).json({ error: 'Invalid Bark Key' });
  }
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run('bark_key', bark_key);
  res.json({ success: true });
});

// Cron setup
cron.schedule(CHECK_INTERVAL, () => {
  console.log(`[${new Date().toISOString()}] Running automated monitors...`);
  runMonitor();
});

// Initialize server and run check immediately
app.listen(PORT, () => {
  console.log(`Server optimized & running on http://localhost:${PORT}`);
  console.log(`Interval: ${CHECK_INTERVAL}`);
});
