# NanoMonitor 抢购系统监控

A premium, open-source web monitoring system built for speed and aesthetics. Monitor sales pages, stock changes, and price updates on Any website.

## ✨ Features
- **URL Monitoring**: Real-time periodic checks on any URL.
- **Bark Notifications**: Get instant push notifications on your phone.
- **Preium Dashboard**: Glassmorphism UI with real-time stats.
- **Linux Ready**: Optimized for VPS deployment.

## 🚀 Getting Started

### 1. Requirements
- Node.js v16+
- Google Chrome/Chromium (for Linux VPS: `apt install chromium-browser`)

### 2. Installation
```bash
# Clone the repository
git clone <this-repo>
cd bbb

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 3. Running the App
**Option A: Automated (Linux/Mac)**
```bash
chmod +x start.sh
./start.sh
```

**Option B: Manual (Development)**
- Terminal 1: `cd server && npm start`
- Terminal 2: `cd client && npm run dev`

### 4. Configuration
1. Open the web UI (usually `http://localhost:5173`).
2. Download the [Bark App](https://github.com/Finb/Bark) on your iOS/Android.
3. Copy your Bark Token and paste it into the **Configurations** section.
4. Add URLs you want to monitor.

## 🛡️ Architecture
- **Backend**: Node.js, Express, Puppeteer (Headless Browser), SQLite.
- **Frontend**: React, Vite, Tailwind CSS, Lucide icons, Framer Motion.
- **Monitoring**: Cron-based scheduling (1-minute intervals by default).
