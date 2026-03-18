# ⚡ NanoMonitor 抢购系统监控

[English](#english) | [中文](#chinese)

---

<a name="chinese"></a>

## 🇨🇳 中文说明

NanoMonitor 是一个专为 Linux VPS 优化的专业级网页监控工具。它通过无头浏览器（Headless Browser）实时追踪目标页面的库存、价格或任何文字变动，并通过 Bark 推送通知至手机。

### ✨ 核心原理与优化 (已执行 10+ 优化)
1.  **SQLite 数据库驱动**：系统内置 SQLite 存储，使用 WAL 模式支持高并发读写，自动记录所有变动历史。
2.  **Puppeteer 智能抓取**：不仅仅是 HTML 请求，它模拟真实浏览器行为，支持动态加载的 JavaScript 页面。
3.  **资源屏蔽优化 (Optimization)**：抓取时自动拦截图片、字体和视频，节省 80% 的流量并降低 CPU 负载。
4.  **智能提取 (Heuristic)**：支持 JSON-LD 结构化数据提取，对电商平台的商品价格抓取极其精准。
5.  **变动详情差分 (Diffing)**：不再只是“内容已更改”，系统现在会计算新增和删除的具体项目。
6.  **状态实时追踪**：前端仪表盘实时显示监控状态（空闲、正在检查、错误），并记录详细的错误日志。
7.  **环境配置隔离**：支持 `.env` 文件配置端口和 Cron 定时频率。
8.  **自动重试与防重叠**：如果网页加载缓慢，系统会自动跳过正在进行的任务，防止进程堆积。
9.  **Bark 集成**：支持通过 Bark 推送带 URL 链接的通知，点击直接跳转抢购。
10. **高级 UI**：基于 Framer Motion 的动效与透明玻璃拟态设计（Glassmorphism）。

### 🚀 快速开始

#### 关于“编译” (Compilation)
*   **后端 (Server)**：基于 Node.js，**不需要编译**，直接运行即可。
*   **前端 (Client)**：开发模式下无需编译。但在**生产环境**部署时，建议运行 `npm run build`。这会将 React 代码打包成静态 HTML/JS 文件，以便在浏览器中获得极速加载体验。

#### 安装步骤
```bash
# 进入服务端并安装
cd server && npm install
npm start

# 进入客户端并测试
cd ../client && npm install
npm run dev
```

---

<a name="english"></a>

## 🇺🇸 English Description

NanoMonitor is a high-performance web monitoring tool optimized for Linux VPS. It tracks stock, price, or text changes using a headless browser and dispatches instant push notifications via Bark.

### ✨ Key Optimizations (10+ Implemented)
1.  **DB Driven**: Powered by SQLite with WAL mode for speed and history persistence.
2.  **Resource Blocking**: Intercepts images/fonts during scraping to save bandwidth and CPU.
3.  **Schema Support**: Extracts data from `application/ld+json` for perfect e-commerce tracking.
4.  **Precision Diffing**: Detects exactly which items were added/removed.
5.  **Health Monitoring**: Real-time status badges (Idle, Checking, Error) with log persistence.
6.  **Environment Sync**: Fully configurable via `.env` files.
7.  **Concurrency Safety**: Prevents monitor overlap on slow networks.
8.  **Glassmorphism UI**: High-end aesthetic with responsive layouts and micro-animations.
9.  **Automated Cron**: Flexible scheduling using standard cron syntax.
10. **Headless Engine**: Full JavaScript execution support via Puppeteer.

### 🛠 Deployment

#### Is Compilation Required?
*   **Backend**: Node.js based, **no compilation** needed. Just run script.
*   **Frontend**: Vite/React based. For production, run `npm run build` to generate optimized assets.

#### Steps
```bash
# Start Backend
cd server && npm install && npm start

# Start Frontend (Dev mode)
cd client && npm install && npm run dev
```

## 🛡️ License
MIT - Free to use and modify.
