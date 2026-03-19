const puppeteer = require('puppeteer');
const db = require('./db');
const { sendBarkNotification } = require('./notify');

const VERSION = 'v1.7.4';
const MAX_CHANGES_PER_SITE = 20;

// ── 浏览器实例池 (修复资源泄漏) ───────────────────────────────────────────────
let browserPool = null;
let browserLock = false;

const getBrowser = async () => {
  if (browserPool && browserPool.isConnected()) {
    return browserPool;
  }
  browserLock = true;
  browserPool = await launchBrowser();
  browserLock = false;
  return browserPool;
};

const closeBrowser = async () => {
  if (browserPool && browserPool.isConnected()) {
    try {
      await browserPool.close();
    } catch (e) {
      console.error('[Browser Close Error]', e.message);
    }
    browserPool = null;
  }
};

// ── 噪音配置 (v1.7.4 精简) ───────────────────────────────────────────────────
const IGNORE_TAGS = ['script', 'style', 'noscript', 'nav', 'footer', 'header', 'aside', 'iframe', 'svg', 'button', 'input', 'form'];
// 移除 'notice' 等可能包含正文内容的关键词
const IGNORE_CLASSES_IDS = ['menu', 'nav', 'footer', 'aside', 'copyright', 'sidebar', 'popup', 'modal', 'advert', 'breadcrumb', 'customer'];
const NOISE_KEYWORDS = ['版权所有', '备案号', 'ICP备', '网安备', '关于我们', '投诉举报', '扫码关注', 'Copyright', 'All Rights Reserved'];

const NOISE_LINE_RE = /^(\d{1,4}[:\-\/]\d{2}|\d+\.?\d*\s*(件|个|条|次|人|分钟前|小时前|天前|秒前|评论|浏览|收藏|点赞|已售|库存|剩余|还剩|in stock|left|%|折))$/i;

// ── 启动浏览器 ──────────────────────────────────────────────────────────
const launchBrowser = () => puppeteer.launch({ 
  headless: 'new', 
  args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
    '--disable-gpu', '--window-size=1280,1000'
  ] 
});

// ── 智能提取快照 (v1.7.4) ────────────────────────────────────────────────
const extractSnapshot = async (page) => {
  return page.evaluate((IGNORE_TAGS, IGNORE_CLASSES_IDS, NOISE_KEYWORDS) => {
    let lines = [];
    const seen = new Set();

    // 1. 深度遍历策略 (核心算法)
    const walk = (el) => {
      // 过滤脚本样式和隐藏标签
      if (!el || IGNORE_TAGS.includes(el.tagName?.toLowerCase())) return;
      
      // 注意：不再检查 offsetParent，因为在某些动态加载场景下它会误判为 null
      
      // 命中黑名单 Class/ID 的容器直接斩断
      const idCls = (el.id + el.className).toLowerCase();
      if (IGNORE_CLASSES_IDS.some(tag => idCls.includes(tag))) return;

      if (el.childElementCount === 0) {
        const text = el.innerText?.replace(/\s+/g, ' ').trim();
        if (!text || text.length < 3 || seen.has(text)) return;
        
        // 判定噪音关键词
        if (NOISE_KEYWORDS.some(k => text.includes(k))) return;

        seen.add(text);
        lines.push(text);
      } else {
        for (const child of el.children) walk(child);
      }
    };

    walk(document.body);
    
    // 2. 兜底策略：如果智能算法完全没抓到东西，说明 DOM 结构可能太坑，直接退回到全量内容
    if (lines.length < 5) {
      const raw = document.body.innerText.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 5 && !seen.has(l));
      lines = lines.concat(raw);
    }
    
    // 3. 内容精简
    return lines.filter(l => {
      if (l.split('|').length > 5) return false;
      // 段落长度保护：250 字符
      if (l.length > 250 && !l.includes('￥') && !l.includes('$')) return false; 
      return true;
    }).slice(0, 300);
  }, IGNORE_TAGS, IGNORE_CLASSES_IDS, NOISE_KEYWORDS);
};

// ── 噪音行识别 (变动检测时使用) ──────────────────────────────────────────
const isNoiseLine = (line) => {
  const t = line.trim();
  if (/^\d+$/.test(t)) return true;
  if (/\d+\s*(分钟|小时|天|秒)前/.test(t)) return true;
  if (NOISE_LINE_RE.test(t)) return true;
  return false;
};

const smartDiff = (oldLines, newLines) => {
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);
  const added = newLines.filter(l => !oldSet.has(l) && !isNoiseLine(l));
  const removed = oldLines.filter(l => !newSet.has(l) && !isNoiseLine(l));
  return { added, removed };
};

const buildSummary = (siteName, added, removed) => {
  const parts = [];
  if (added.length > 0) parts.push(`🆕 [新增] ${added.slice(0, 5).join(' | ')}`);
  if (removed.length > 0) parts.push(`🗑️ [消失] ${removed.slice(0, 5).join(' | ')}`);
  return parts.join('\n') || '内容结构有细微变动';
};

const checkSite = async (site) => {
  let browser;
  let page;
  try {
    db.prepare('UPDATE sites SET status = ? WHERE id = ?').run('checking', site.id);
    browser = await getBrowser();
    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

    try {
      await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch {
      await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    }

    await new Promise(r => setTimeout(r, 3000));

    let currentLines = await extractSnapshot(page);
    const currentContent = JSON.stringify(currentLines);

    if (site.last_content && site.last_content !== currentContent) {
      const oldLines = JSON.parse(site.last_content);
      const { added, removed } = smartDiff(oldLines, currentLines);
      const significant = added.length > 0 || removed.length > 0;
      if (significant) {
        const summary = buildSummary(site.name, added, removed);
        db.prepare('INSERT INTO changes (site_id, diff_summary) VALUES (?, ?)')
          .run(site.id, summary);
        db.prepare('DELETE FROM changes WHERE site_id = ? AND id NOT IN (SELECT id FROM changes WHERE site_id = ? ORDER BY detected_at DESC LIMIT 20)')
          .run(site.id, site.id);
        await sendBarkNotification(`🔔 ${site.name}`, summary, site.url);
      }
    }

    db.prepare('UPDATE sites SET last_content = ?, last_checked = CURRENT_TIMESTAMP, status = ?, error_message = NULL WHERE id = ?')
      .run(currentContent, 'idle', site.id);

  } catch (error) {
    db.prepare('UPDATE sites SET status = ?, error_message = ? WHERE id = ?')
      .run('error', error.message.substring(0, 300), site.id);
  } finally {
    if (page) await page.close();
  }
};

const runMonitor = async () => {
  // 防重叠锁：如果已有任务在运行，直接跳过
  if (runMonitor.isRunning) {
    console.log('[Monitor] Previous run still in progress, skipping...');
    return;
  }
  
  runMonitor.isRunning = true;
  try {
    const sites = db.prepare("SELECT * FROM sites WHERE is_active = 1").all();
    const now = Date.now();
    for (const s of sites) {
      if (s.status === 'checking') continue;
      // 修复时间戳解析：统一处理 ISO 格式
      let lastTime = 0;
      if (s.last_checked) {
        const lc = s.last_checked;
        // 确保是有效的 ISO 格式
        const isoString = lc.endsWith('Z') ? lc : lc + 'Z';
        lastTime = new Date(isoString).getTime();
        if (isNaN(lastTime)) {
          console.warn(`[Monitor] Invalid timestamp for site ${s.id}: ${lc}`);
          lastTime = 0;
        }
      }
      if ((now - lastTime) / 1000 < (s.interval || 60)) continue;
      await checkSite(s);
    }
  } finally {
    runMonitor.isRunning = false;
  }
};

const discoverProducts = async (url) => {
  let browser;
  let page;
  try {
    browser = await getBrowser();
    page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
    return await page.evaluate(() => {
      const items = [];
      const PRICE_RE = /([￥$¥]\s?\d[\d,.]*|\d[\d,.]*\s?(元|\/月|起))/i;
      document.querySelectorAll('div, section, article, li').forEach(el => {
        const text = el.innerText?.trim();
        if (text && text.length < 500 && PRICE_RE.test(text)) {
          const name = el.innerText.split('\n')[0].substring(0, 50);
          const priceMatch = text.match(PRICE_RE);
          if (name.length > 4) {
            items.push({ name, price: priceMatch ? priceMatch[0] : 'N/A', url: location.href });
          }
        }
      });
      return items.slice(0, 20);
    });
  } catch { return []; }
  finally { if (page) await page.close(); }
};

module.exports = { runMonitor, checkSite, discoverProducts };
