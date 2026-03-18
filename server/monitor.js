const puppeteer = require('puppeteer');
const db = require('./db');
const { sendBarkNotification } = require('./notify');

const checkSite = async (site) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Critical for Linux environments
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
    await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Extraction logic: find common product-like structures
    const items = await page.evaluate(() => {
      const results = [];
      // Heuristic 1: Find elements with "price" or "product" in class/id
      const candidates = document.querySelectorAll("[class*='product'], [class*='item'], [id*='product'], [id*='item'], article, li");
      
      candidates.forEach(el => {
        const text = el.innerText.trim();
        if (text.length > 5 && text.length < 500) {
          // Look for price patterns ($ or ￥ or symbols)
          if (/[\$\d\.,]{2,10}[元块]/.test(text) || /[\¥\d\.,]{2,10}/.test(text)) {
             results.push(text.split('\n')[0]); // Take the first line as name
          }
        }
      });
      
      // If we found nothing, let's just return key info
      return results.length > 0 ? results : [document.body.innerText.substring(0, 500)];
    });

    const currentContent = JSON.stringify(items);

    if (site.last_content && site.last_content !== currentContent) {
      // Change detected!
      console.log(`Change detected at ${site.url}`);
      
      // Calculate a simple diff (e.g. first 100 characters of change or just a message)
      const diffSummary = `Changes detected on ${site.name || site.url}`;
      
      // Store the change
      db.prepare('INSERT INTO changes (site_id, diff) VALUES (?, ?)').run(site.id, 'Content changed');
      
      // Notify
      await sendBarkNotification('Monitoring Alert', diffSummary, site.url);
    }

    // Update the site status
    db.prepare('UPDATE sites SET last_content = ?, last_checked = CURRENT_TIMESTAMP WHERE id = ?')
      .run(currentContent, site.id);

  } catch (error) {
    console.error(`Error checking ${site.url}:`, error.message);
  } finally {
    if (browser) await browser.close();
  }
};

const runMonitor = async () => {
  const activeSites = db.prepare('SELECT * FROM sites WHERE is_active = 1').all();
  for (const site of activeSites) {
    await checkSite(site);
  }
};

module.exports = { runMonitor, checkSite };
