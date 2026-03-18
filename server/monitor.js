const puppeteer = require('puppeteer');
const db = require('./db');
const { sendBarkNotification } = require('./notify');

const VERSION = 'v1.6.3';
const MAX_CHANGES_PER_SITE = 20;

// ── 噪音配置 ────────────────────────────────────────────────────────────
const IGNORE_TAGS = ['script', 'style', 'noscript', 'nav', 'footer', 'header', 'aside', 'iframe', 'svg', 'button', 'input', 'form'];
const IGNORE_CLASSES_IDS = ['menu', 'nav', 'footer', 'aside', 'copyright', 'bottom', 'top', 'sidebar', 'popup', 'modal', 'advert', 'notice', 'breadcrumb', 'contact', 'customer'];
const NOISE_KEYWORDS = ['版权', '备案', 'ICP备', '网安备', '联系我们', '举报', '关于我们', '投诉', '友情链接', '常见问题', '下载中心', '会员中心', '注册', '登录', '扫码关注', '微信', 'QQ', '服务条款', '隐私政策', '地址：', 'Copyright', 'All Rights Reserved'];

const NOISE_LINE_RE = /^(\d{1,4}[:\-\/]\d{2}|\d+\.?\d*\s*(件|个|条|次|人|分钟前|小时前|天前|秒前|评论|浏览|收藏|点赞|已售|库存|剩余|还剩|in stock|left|%|折))$/i;

// ── 启动浏览器 ──────────────────────────────────────────────────────────
const launchBrowser = () => puppeteer.launch({ 
  headless: 'new', 
  args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
    '--disable-gpu', '--window-size=1280,1000'
  ] 
});

// ── 智能提取快照 (v1.6.3) ────────────────────────────────────────────────
const extractSnapshot = async (page) => {
  return page.evaluate((IGNORE_TAGS, IGNORE_CLASSES_IDS, NOISE_KEYWORDS) => {
    const lines = [];
    const seen = new Set();

    // 1. 预清理干扰元素
    document.querySelectorAll(IGNORE_TAGS.join(',')).forEach(el => el.remove());
    
    // 2. 根据 Class/ID 清理冗余块 (footer, nav 等)
    IGNORE_CLASSES_IDS.forEach(tag => {
      document.querySelectorAll(`[class*="${tag}"], [id*="${tag}"]`).forEach(el => el.remove());
    });

    const walk = (el) => {
      if (!el || el.offsetParent === null) return; // 跳过隐藏元素
      
      // 检查文本内容是否包含绝对噪音关键字
      const text = el.innerText?.trim();
      if (!text) return;
      
      if (el.childElementCount === 0) {
        const t = text.replace(/\s+/g, ' ').substring(0, 500);
        
        // 智能过滤
        if (t.length < 4) return;
        if (seen.has(t)) return;
        
        // 判定噪音
        const isNoise = NOISE_KEYWORDS.some(k => t.includes(k));
        if (isNoise) return;

        seen.add(t);
        lines.push(t);
      } else {
        for (const child of el.children) walk(child);
      }
    };

    walk(document.body);
    
    // 3. 后期精简：如果一行字包含大量标点或看起来像菜单，剔除
    return lines.filter(l => {
      if (l.split('|').length > 5) return false;
      if (l.split(' ').length > 20 && !l.includes('￥') && !l.includes('$')) return false; // 太长的段落如果没价格可能是文章
      return true;
    }).slice(0, 300);
  }, IGNORE_TAGS, IGNORE_CLASSES_IDS, NOISE_KEYWORDS);
};

// ── 噪音行识别 (变动检测时使用) ──────────────────────────────────────────
const isNoiseLine = (line) => {
  const t = line.trim();
  if (/^\d+$/.test(t)) return true; // 纯数字通常是 ID 或浏览量
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
  try {
    db.prepare('UPDATE sites SET status = ? WHERE id = ?').run('checking', site.id);
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

    // 导航降级策略
    try {
      await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch {
      await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    }

    await new Promise(r => setTimeout(r, 2000));

    let currentLines;
    try {
      currentLines = await extractSnapshot(page);
    } catch (e) {
      await new Promise(r => setTimeout(r, 2000));
      currentLines = await extractSnapshot(page);
    }
    
    const currentContent = JSON.stringify(currentLines);

    if (site.last_content && site.last_content !== currentContent) {
      const oldLines = JSON.parse(site.last_content);
      const { added, removed } = smartDiff(oldLines, currentLines);

      // 决定是否记录
      const significant = added.length > 0 || removed.length > 0;
      if (significant) {
        const summary = buildSummary(site.name, added, removed);
        db.prepare('INSERT INTO changes (site_id, diff_summary) VALUES (?, ?)')
          .run(site.id, summary);
        
        // 剪枝
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
    if (browser) await browser.close();
  }
};

const runMonitor = async () => {
  const sites = db.prepare("SELECT * FROM sites WHERE is_active = 1").all();
  const now = Date.now();
  for (const s of sites) {
    if (s.status === 'checking') continue;
    const last = s.last_checked ? new Date(s.last_checked + 'Z').getTime() : 0;
    if ((now - last) / 1000 < (s.interval || 60)) continue;
    await checkSite(s);
  }
};

const discoverProducts = async (url) => {
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
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
  finally { if (browser) await browser.close(); }
};

module.exports = { runMonitor, checkSite, discoverProducts };
