const puppeteer = require('puppeteer');
const db = require('./db');
const { sendBarkNotification } = require('./notify');

// Optimization 2: Common Product Selectors Cache
const PRODUCT_SELECTORS = [
  '[class*="product"]', '[class*="item"]', '[id*="product"]', '[id*="item"]', 
  'article', 'li', 'section', '.price', '.amount'
];

const checkSite = async (site) => {
  let browser;
  try {
    // Update status to checking
    db.prepare('UPDATE sites SET status = ? WHERE id = ?').run('checking', site.id);

    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Memory optimization for VPS
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    // Optimization 3: Resource Blocking (Save bandwidth/CPU)
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'font', 'stylesheet', 'media'].includes(type) && !site.url.includes('api')) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
    await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 45000 });

    // Optimization 4: Advanced Product Extraction (JSON-LD + Selectors)
    const extractionResult = await page.evaluate((selectors) => {
      const results = [];
      
      // Try JSON-LD first (most accurate for e-commerce)
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      scripts.forEach(s => {
        try {
          const data = JSON.parse(s.innerText);
          if (data['@type'] === 'Product' || data['@type'] === 'Offer') {
            results.push(`${data.name || 'Product'} - ${data.offers?.price || 'N/A'} ${data.offers?.priceCurrency || ''}`);
          }
        } catch(e) {}
      });

      if (results.length === 0) {
        // Fallback to heuristic selectors
        const candidates = document.querySelectorAll(selectors.join(','));
        candidates.forEach(el => {
          const text = el.innerText.trim();
          if (text.length > 5 && text.length < 300) {
             if (/[\$\d\.,]{2,10}/.test(text) || /[￥\d\.,]{2,10}/.test(text)) {
                const cleanText = text.replace(/\s+/g, ' ');
                if (!results.includes(cleanText)) results.push(cleanText);
             }
          }
        });
      }
      
      return results.length > 0 ? results : [document.body.innerText.substring(0, 1000)];
    }, PRODUCT_SELECTORS);

    const currentContent = JSON.stringify(extractionResult);

    if (site.last_content && site.last_content !== currentContent) {
      // Change detected!
      const oldArr = JSON.parse(site.last_content || "[]");
      const newItems = extractionResult.filter(i => !oldArr.includes(i));
      const removedItems = oldArr.filter(i => !extractionResult.includes(i));
      
      const diffSummary = `Changed: ${newItems.length} new items, ${removedItems.length} removed. First change: ${newItems[0] || 'Unknown'}`;
      
      db.prepare('INSERT INTO changes (site_id, diff_summary, full_snapshot) VALUES (?, ?, ?)')
        .run(site.id, diffSummary, currentContent);
      
      await sendBarkNotification(`Target Update: ${site.name}`, diffSummary, site.url);
    }

    db.prepare('UPDATE sites SET last_content = ?, last_checked = CURRENT_TIMESTAMP, status = ?, error_message = NULL WHERE id = ?')
      .run(currentContent, 'idle', site.id);

  } catch (error) {
    console.error(`Error checking ${site.url}:`, error.message);
    db.prepare('UPDATE sites SET status = ?, error_message = ? WHERE id = ?')
      .run('error', error.message, site.id);
  } finally {
    if (browser) await browser.close();
  }
};

const runMonitor = async () => {
  const activeSites = db.prepare('SELECT * FROM sites WHERE is_active = 1').all();
  for (const site of activeSites) {
    // Skip if already checking to avoid overlap on slow sites
    if (site.status === 'checking') continue;
    await checkSite(site);
  }
};

const discoverProducts = async (url) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const products = await page.evaluate(() => {
      const items = [];
      
      // 1. Try JSON-LD
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      scripts.forEach(s => {
        try {
          const data = JSON.parse(s.innerText);
          const processItem = (item) => {
            if (item['@type'] === 'Product' || item['@type'] === 'Offer') {
              items.push({
                name: item.name || 'Unknown Product',
                price: item.offers?.price || 'N/A',
                currency: item.offers?.priceCurrency || '',
                image: item.image || '',
                url: item.url || window.location.href
              });
            }
          };
          if (Array.isArray(data)) data.forEach(processItem);
          else processItem(data);
        } catch(e) {}
      });

      if (items.length > 0) return items;

      // 2. Heuristic: Look for elements that look like price + text
      const priceRegex = /([￥$¥]\s?\d+(\.\d+)?|\d+(\.\d+)?\s?(元|\/月|起|Monthly|每月))/i;
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null, false);
      let node;
      const candidates = [];
      
      while (node = walk.nextNode()) {
        let isPrice = false;
        if (node.nodeType === Node.TEXT_NODE) {
          if (priceRegex.test(node.textContent.trim())) isPrice = true;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const className = (node.className || '').toString().toLowerCase();
          const id = (node.id || '').toString().toLowerCase();
          if (className.includes('price') || className.includes('amount') || id.includes('price')) {
            isPrice = true;
          }
        }

        if (isPrice) {
          let parent = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
          // Look for container (usually a box containing name + price)
          for (let i = 0; i < 6; i++) {
            if (!parent) break;
            const parentText = parent.innerText;
            if (parentText.length > 10 && parentText.length < 800) {
              // Priority: elements with headings or specific tags are better candidates
              if (parent.querySelector('h1,h2,h3,h4,h5,h6,strong,b') || parent.className.includes('item') || parent.className.includes('product')) {
                candidates.push(parent);
                break;
              }
            }
            parent = parent.parentElement;
          }
        }
      }

      // Deduplicate and extract details from candidates
      const seen = new Set();
      candidates.forEach(el => {
        const fullText = el.innerText.replace(/\s+/g, ' ').trim();
        if (seen.has(fullText) || fullText.length < 5) return;
        seen.add(fullText);

        // Name extraction: try to find the boldest/largest text first
        const heading = el.querySelector('h1,h2,h3,h4,h5,h6,strong,b');
        const name = heading ? heading.innerText.trim() : fullText.split('\n')[0].substring(0, 100);
        const priceMatch = fullText.match(/([￥$¥]\s?\d+(\.\d+)?|\d+(\.\d+)?\s?(元|\/月|起|Monthly|每月))/i);
        
        items.push({
          name: name || 'Unknown Product',
          price: priceMatch ? priceMatch[0] : 'N/A',
          text: fullText.substring(0, 200),
          image: el.querySelector('img')?.src || ''
        });
      });

      return items;
    });

    return products;
  } catch (error) {
    console.error(`Error discovering products at ${url}:`, error.message);
    return [];
  } finally {
    if (browser) await browser.close();
  }
};

module.exports = { runMonitor, checkSite, discoverProducts };
