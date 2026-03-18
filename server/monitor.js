const puppeteer = require('puppeteer');
const db = require('./db');
const { sendBarkNotification } = require('./notify');

const VERSION = 'v1.5.0';
const MAX_CHANGES_PER_SITE = 20; // 每站点最多保留的历史记录数

// ── Puppeteer 启动参数 ──────────────────────────────────────────
const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--window-size=1280,800',
];

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── 启动浏览器 ──────────────────────────────────────────────────
const launchBrowser = () => puppeteer.launch({ headless: 'new', args: LAUNCH_ARGS });

// ── 从页面提取有意义的文本快照 ───────────────────────────────────
// 策略：忽略导航/菜单/脚本，聚焦于主体内容区域
const extractSnapshot = async (page) => {
  return page.evaluate(() => {
    // 移除干扰节点
    const NOISE = ['script', 'style', 'noscript', 'nav', 'footer', 'header', 'aside', 'iframe', 'svg'];
    const clone = document.body.cloneNode(true);
    NOISE.forEach(tag => clone.querySelectorAll(tag).forEach(el => el.remove()));

    // 提取主要文本行（去重、去空行）
    const lines = [];
    const seen = new Set();

    const walk = (el) => {
      if (!el) return;
      if (el.nodeType === Node.TEXT_NODE) {
        const t = el.textContent.replace(/\s+/g, ' ').trim();
        // 过滤掉太短或已重复的行
        if (t.length > 5 && !seen.has(t)) {
          seen.add(t);
          lines.push(t);
        }
        return;
      }
      for (const child of el.childNodes) walk(child);
    };
    walk(clone);

    // 只保留前 300 行，避免超大快照
    return lines.slice(0, 300);
  });
};

// ── 噪音行识别 —— 这些变化不触发警报 ───────────────────────────
// 匹配：纯数字、时间戳、库存数、浏览量、评论数等频繁微变内容
const NOISE_LINE_RE = /^(\d{1,4}[:\-\/]\d{2}|\d+\.?\d*\s*(件|个|条|次|人|分钟前|小时前|天前|秒前|评论|浏览|收藏|点赞|已售|库存|剩余|还剩|in stock|left))$/i;

const isNoiseLine = (line) => {
  const t = line.trim();
  // 纯数字行
  if (/^\d+$/.test(t)) return true;
  // 时间相关
  if (/\d+\s*(分钟|小时|天|秒)前/.test(t)) return true;
  // 库存/数量相关
  if (NOISE_LINE_RE.test(t)) return true;
  return false;
};

// ── 计算智能 diff ───────────────────────────────────────────────
const smartDiff = (oldLines, newLines) => {
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  // 过滤掉纯噪音行再做对比
  const added   = newLines.filter(l => !oldSet.has(l) && !isNoiseLine(l));
  const removed = oldLines.filter(l => !newSet.has(l) && !isNoiseLine(l));

  return { added, removed };
};

// ── 生成人类可读的变动摘要 ─────────────────────────────────────
const buildSummary = (siteName, added, removed) => {
  const parts = [];
  if (added.length > 0) {
    parts.push(`🆕 新增 ${added.length} 项：${added.slice(0, 3).join(' | ')}`);
  }
  if (removed.length > 0) {
    parts.push(`🗑️ 消失 ${removed.length} 项：${removed.slice(0, 3).join(' | ')}`);
  }
  return parts.join('\n') || '内容有变动但无法提取摘要';
};

// ── 检查单个站点 ────────────────────────────────────────────────
const checkSite = async (site) => {
  let browser;
  try {
    db.prepare('UPDATE sites SET status = ? WHERE id = ?').run('checking', site.id);

    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    // 阻塞图片/字体/多媒体（省带宽）——但保留 JS/XHR（动态页面需要）
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (['image', 'font', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 45000 });

    // 等待页面主体内容稳定（给动态渲染多一点时间）
    await new Promise(r => setTimeout(r, 1500));

    const currentLines = await extractSnapshot(page);
    const currentContent = JSON.stringify(currentLines);

    if (site.last_content && site.last_content !== currentContent) {
      const oldLines = JSON.parse(site.last_content);
      const { added, removed } = smartDiff(oldLines, currentLines);

      // 过滤掉极小的噪音（只有1项新增且是时间类内容，不报告）
      const isNoise = added.length + removed.length < 2 &&
        added.concat(removed).every(l => /^\d{1,2}[:\-\/]\d{2}/.test(l) || l.length < 8);

      if (!isNoise) {
        const diffSummary = buildSummary(site.name, added, removed);
        db.prepare('INSERT INTO changes (site_id, diff_summary) VALUES (?, ?)')
          .run(site.id, diffSummary);
        // 剪枝：每站点只保留最近 MAX_CHANGES_PER_SITE 条
        db.prepare(
          `DELETE FROM changes WHERE site_id = ? AND id NOT IN (
            SELECT id FROM changes WHERE site_id = ? ORDER BY detected_at DESC LIMIT ?
          )`
        ).run(site.id, site.id, MAX_CHANGES_PER_SITE);
        await sendBarkNotification(`🔔 ${site.name} 有更新！`, diffSummary, site.url);
      }
    }

    db.prepare('UPDATE sites SET last_content = ?, last_checked = CURRENT_TIMESTAMP, status = ?, error_message = NULL WHERE id = ?')
      .run(currentContent, 'idle', site.id);

  } catch (error) {
    console.error(`[checkSite] Error @ ${site.url}:`, error.message);
    db.prepare('UPDATE sites SET status = ?, error_message = ? WHERE id = ?')
      .run('error', error.message.substring(0, 300), site.id);
  } finally {
    if (browser) await browser.close();
  }
};

// ── 批量运行监控（按各站点独立间隔决定是否触发）────────────────────
const runMonitor = async () => {
  const activeSites = db.prepare("SELECT * FROM sites WHERE is_active = 1").all();
  const now = Date.now();
  for (const site of activeSites) {
    if (site.status === 'checking') continue;
    // 计算距离上次检查的秒数
    const lastMs = site.last_checked ? new Date(site.last_checked + 'Z').getTime() : 0;
    const elapsed = (now - lastMs) / 1000;
    const interval = Number(site.interval) || 60;
    if (elapsed < interval) continue; // 未到时间，跳过
    await checkSite(site);
  }
};

// ── 智能商品发现 ────────────────────────────────────────────────
const discoverProducts = async (url) => {
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000));

    const items = await page.evaluate(() => {
      const results = [];

      // ── 策略 1: JSON-LD 结构化商品数据（最准确）
      document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
        try {
          const data = JSON.parse(s.textContent);
          const process = (d) => {
            if (d['@type'] === 'Product' || d['@type'] === 'Offer') {
              results.push({
                name: d.name || '未知商品',
                price: d.offers?.price ? `${d.offers.priceCurrency || ''}${d.offers.price}` : 'N/A',
                image: Array.isArray(d.image) ? d.image[0] : (d.image || ''),
                url: d.url || location.href,
              });
            }
          };
          if (Array.isArray(data)) data.forEach(process);
          else process(data);
        } catch (e) {}
      });

      if (results.length > 0) return results;

      // ── 策略 2: 寻找常见商品卡片容器
      const CARD_SELECTORS = [
        '[class*="item"]', '[class*="card"]', '[class*="product"]',
        '[class*="goods"]', '[class*="article"]', 'article', 'li.feed-item'
      ];
      const PRICE_RE = /([￥$¥]\s?\d[\d,.]*|\d[\d,.]*\s?(元|\/月|起|RMB))/i;
      const seen = new Set();

      const tryCard = (el) => {
        const text = el.innerText?.replace(/\s+/g, ' ').trim() || '';
        if (text.length < 10 || text.length > 1000 || seen.has(text)) return;
        seen.add(text);

        // 必须包含价格信息或明显的商品名
        const hasPrice = PRICE_RE.test(text);
        const heading = el.querySelector('h1,h2,h3,h4,h5,h6,strong,b,a[title],.title,.name,.goods-name,.item-title');
        const name = (heading ? heading.innerText : text.split('\n')[0]).trim().substring(0, 80);
        const priceMatch = text.match(PRICE_RE);

        if (hasPrice || name.length > 8) {
          results.push({
            name: name || '未知',
            price: priceMatch ? priceMatch[0] : 'N/A',
            image: (el.querySelector('img[src]') || el.querySelector('img[data-src]'))?.getAttribute('src') || '',
            url: el.querySelector('a[href]')?.href || location.href,
          });
        }
      };

      CARD_SELECTORS.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          // 跳过太小/太大的容器
          const rect = el.getBoundingClientRect();
          if (rect.width < 50 || rect.height < 30) return;
          tryCard(el);
        });
      });

      return results.slice(0, 30); // 最多返回30条
    });

    return items;
  } catch (error) {
    console.error(`[discoverProducts] Error @ ${url}:`, error.message);
    throw new Error(error.message);
  } finally {
    if (browser) await browser.close();
  }
};

module.exports = { runMonitor, checkSite, discoverProducts };
