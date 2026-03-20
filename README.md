# NanoMonitor - 极简网页变动监控工具 🚀

**一行命令安装 · 自动生成账号密码 · 菜单式管理**

[![Version](https://img.shields.io/badge/version-v1.8.4-blue.svg)](https://github.com/ctsunny/bbb)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## 📋 项目简介

### 一、项目概述

#### 1.1 项目定位
NanoMonitor 是一款专为 Linux VPS 设计的轻量级网页内容变动监控工具（当前版本 **v1.8.4**）。它通过无头浏览器自动抓取指定网页，利用智能算法过滤广告、时间戳等噪音内容，精准识别页面核心内容的变化，并通过 Bark 推送实时通知用户。

#### 1.2 解决痛点
- **手动刷新繁琐**：无需人工定期检查网页更新
- **信息遗漏风险**：7×24 小时自动监控，不错过任何变动
- **噪音干扰严重**：智能过滤广告、推荐位、时间等非核心内容
- **部署复杂**：传统监控工具配置繁琐，本工具一行命令即可使用
- **资源占用高**：优化浏览器实例管理，低配 VPS 也能流畅运行

#### 1.3 适用场景
- 📰 新闻网站更新监控（政策发布、行业新闻）
- 💰 价格变动追踪（电商商品、机票酒店）
- 📢 公告通知监测（学校通知、公司通告）
- 📝 博客文章更新（关注博主新文章）
- 🔒 安全漏洞公告（CVE、厂商安全通告）
- 📊 数据页面监控（汇率、股票、排行榜）

---

### 二、核心功能

#### 2.1 智能网页抓取
- **无头浏览器**：基于 Puppeteer 的 Chromium，支持 JavaScript 渲染
- **完整页面加载**：等待动态内容加载完成再提取文本
- **自动 UA 伪装**：使用 Chrome 124 User-Agent 模拟真实浏览器访问
- **双重加载策略**：优先 `networkidle2`，失败后自动降级到 `domcontentloaded`

#### 2.2 智能噪音过滤
- **标签过滤**：自动跳过 `script`、`style`、`nav`、`footer`、`aside` 等噪音标签
- **类名/ID 过滤**：自动忽略包含 `menu`、`nav`、`sidebar`、`advert` 等关键字的容器
- **关键词过滤**：跳过版权信息、备案号等固定噪音文本
- **数字噪音过滤**：忽略"X 分钟前"、"已售 X 件"等动态计数内容

#### 2.3 精准差异对比
- **智能 Diff 算法**：精确比对两次抓取的文本行差异
- **新增/消失识别**：分别标注新增内容（🆕）和消失内容（🗑️）
- **变动摘要**：自动生成变更摘要（最多展示 5 条），快速了解变动概况
- **历史记录**：每个网站保留最近 20 条变动记录

#### 2.4 灵活调度系统
- **分钟级调度**：系统每分钟检查一次，对比每个网站的 `interval` 配置决定是否执行
- **自定义间隔**：每个网站可独立设置检查间隔（秒，默认 60 秒）
- **防重叠执行**：全局锁机制，上次检测未完成时自动跳过

#### 2.5 实时通知推送（Bark）
- **Bark 推送**：iOS 用户可通过 Bark APP 接收即时通知
- **推送内容**：包含网站名称、变动摘要和原页面链接
- **全局配置**：在系统设置中填写 Bark Key，所有监控任务共用

#### 2.6 Web 管理面板
- **任务管理**：添加、编辑、删除、启用/禁用监控任务
- **实时状态**：查看每个任务的状态（idle / checking / error）及上次检测时间
- **变动历史**：按时间倒序展示最近 300 条变动记录
- **快照预览**：查看指定网站当前抓取的文本内容快照
- **系统设置**：修改 Bark Key、查看访问路径、版本信息
- **响应式设计**：支持手机、平板、电脑访问

#### 2.7 安全特性
- **随机访问路径**：后台地址包含随机 token（`/console-{随机16位hex}`），防止扫描
- **登录鉴权**：API 接口需要 token 认证，速率限制 30 次/分钟
- **SSRF 防护**：禁止监控内网地址（10.x、192.168.x、172.16-31.x、127.x 等）
- **XSS 防护**：diff_summary 字段输出时自动转义 HTML 特殊字符
- **随机初始密码**：首次启动自动生成随机管理员密码

---

### 三、技术架构

#### 3.1 系统架构图
```
┌─────────────────────────────────────────────────────────┐
│                    用户层                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │  Web 面板   │    │  API 调用   │    │ Bark 推送   │  │
│  └─────────────┘    └─────────────┘    └─────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              应用层 (Node.js + Express 5.x)              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ 路由控制    │    │ 登录鉴权    │    │ 速率限制    │  │
│  └─────────────┘    └─────────────┘    └─────────────┘  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ 任务管理    │    │ 系统设置    │    │ SSRF 防护   │  │
│  └─────────────┘    └─────────────┘    └─────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   核心层                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ 分钟调度器  │    │ 浏览器实例池│    │ Diff 引擎   │  │
│  └─────────────┘    └─────────────┘    └─────────────┘  │
│  ┌─────────────┐    ┌─────────────┐                     │
│  │ 噪音过滤器  │    │ Bark 推送   │                     │
│  └─────────────┘    └─────────────┘                     │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              数据层 (SQLite · better-sqlite3)            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ sites 表    │    │ changes 表  │    │ settings 表 │  │
│  └─────────────┘    └─────────────┘    └─────────────┘  │
└─────────────────────────────────────────────────────────┘
```

#### 3.2 技术栈详解

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **运行时** | Node.js | 18+ | LTS 版本，稳定可靠 |
| **Web 框架** | Express | 5.x | 轻量高效，生态丰富 |
| **前端框架** | React + Tailwind CSS | 最新 | 现代化 UI |
| **动画** | Framer Motion | 12.x | 流畅交互动效 |
| **图标** | Lucide React | 最新 | 精美图标库 |
| **浏览器自动化** | Puppeteer | 24.x | Google 官方无头浏览器 |
| **数据库** | SQLite · better-sqlite3 | 12.x | 零配置，单文件，WAL 模式 |
| **任务调度** | node-cron | 4.x | 每分钟触发检查循环 |
| **HTTP 客户端** | axios | 1.x | 推送 Bark 通知 |
| **进程管理** | systemd | - | Linux 标准服务管理 |
| **构建工具** | Vite | - | 快速构建前端静态文件 |

#### 3.3 目录结构
```
/opt/nanomon/
├── server/                 # 后端代码
│   ├── index.js           # 主入口（Express 服务 + API 路由）
│   ├── monitor.js         # 监控核心（Puppeteer + Diff 算法）
│   ├── notify.js          # Bark 推送服务
│   ├── db.js              # SQLite 数据库初始化与迁移
│   ├── get_setting.js     # 配置读取工具
│   ├── set_setting.js     # 配置写入工具
│   ├── monitor.db         # SQLite 数据库文件（运行时生成）
│   └── node_modules/      # 后端依赖
├── client/                # 前端代码
│   ├── src/               # React 源码
│   │   ├── App.jsx        # 主应用组件
│   │   └── main.jsx       # 入口文件
│   └── dist/              # 构建后的静态文件（由 Vite 生成）
├── install.sh             # 一键安装脚本
├── menu.sh                # nanomon 管理菜单脚本
├── start.sh               # systemd 服务启动脚本
└── .env.example           # 环境变量示例

/var/lib/nanomon/          # 持久化数据目录
├── config.json            # 安装时生成的配置快照（供参考）
└── backup_*.tar.gz        # 升级时自动备份的数据
```

#### 3.4 数据库结构

| 表名 | 说明 |
|------|------|
| `sites` | 监控任务表（url、name、interval、status、last_content 等） |
| `changes` | 变动记录表（site_id、diff_summary、detected_at） |
| `settings` | 系统配置表（admin_user、admin_pass、access_path、bark_key 等） |

---

### 四、系统要求

#### 4.1 硬件要求

| 配置 | 最低要求 | 推荐配置 |
|------|----------|----------|
| CPU | 1 核心 | 2 核心+ |
| 内存 | 512 MB | 1 GB+ |
| 磁盘 | 500 MB | 1 GB+ |
| 网络 | 1 Mbps | 10 Mbps+ |

**内存占用说明：**
- 空闲状态：约 100–150 MB
- 执行检测时：约 200–400 MB（浏览器实例复用）
- 多任务并发：每增加一个并发任务约增加 100 MB

#### 4.2 软件要求

**支持的操作系统：**
- Ubuntu 18.04 及以上
- Debian 9 及以上
- CentOS 7 及以上
- Rocky Linux 8 及以上
- AlmaLinux 8 及以上

**必需权限：**
- root 权限或 sudo 权限
- 能够安装系统软件包
- 能够注册 systemd 服务
- 开放指定端口（默认 3001）

#### 4.3 网络要求
- 能够访问互联网（抓取目标网页）
- 能够访问 GitHub（首次安装克隆代码）
- 如需 Bark 推送，需能访问 `api.day.app`
- 建议配置防火墙限制外网直接访问管理面板

---

## 🚀 安装教程

### 一键安装（推荐）

```bash
curl -fsSL https://raw.githubusercontent.com/ctsunny/bbb/main/install.sh | sudo bash
```

**安装过程会自动完成：**
1. 安装系统依赖（curl、wget、git 及 Chromium 所需库）
2. 安装 Node.js 20.x（若版本低于 18 则自动升级）
3. 克隆最新代码到 `/opt/nanomon/`
4. 创建数据目录 `/var/lib/nanomon/`
5. 生成随机管理员密码和随机访问路径
6. 注册并启动 systemd 服务
7. 创建全局命令快捷方式 `nanomon`

**安装完成后终端会显示：**
```
=========================================
   🎉 安装成功！
=========================================
📍 访问地址: http://1.2.3.4:3001/a1b2c3d4
👤 管理员账号: admin
🔑 管理员密码: Ab3xK9mNpQr2

⚠️  请妥善保存上述账号密码！
=========================================
```

> ⚠️ **注意：** 请立即记录访问地址和密码，后续可通过 `sudo cat /var/lib/nanomon/config.json` 查看。

### 查看实际后台访问地址

服务启动后，查看服务日志可获取完整后台路径：

```bash
# 查看服务启动日志（含后台路径和初始密码）
sudo journalctl -u nanomon -n 30 --no-pager
```

日志输出示例：
```
🚀 NanoMonitor v1.8.4 已就绪！
🔗 专用后台路径: http://您的服务器IP:3001/console-a1b2c3d4abcd12ef
🔑 登 录 账 号: admin
🔑 登 录 密 码: 4a7f3c2e
```

> 💡 后台路径格式为 `http://IP:3001/console-{随机路径}`，其中随机路径为 16 位 hex 字符串，存储于数据库 `settings` 表的 `access_path` 字段。

---

## 🆙 升级教程

### 方式一：菜单升级（推荐）

```bash
nanomon
# 选择 [1] 一键升级到最新版本
```

升级过程会自动：
1. 备份当前数据到 `/var/lib/nanomon/backup_YYYYMMDD_HHMMSS.tar.gz`
2. 拉取最新代码（`git pull`）
3. 重置到最新提交（`git reset --hard`）
4. 恢复配置文件
5. 重启服务

### 方式二：重新运行安装脚本

```bash
curl -fsSL https://raw.githubusercontent.com/ctsunny/bbb/main/install.sh | sudo bash
```

安装脚本会自动检测旧版本并备份配置，保留原有账号密码。

---

## 🗑️ 卸载教程

### 方式一：菜单卸载（推荐）

```bash
nanomon
# 选择 [7] 完全卸载
# 输入 yes 确认
```

### 方式二：手动卸载

```bash
# 停止并禁用服务
sudo systemctl stop nanomon
sudo systemctl disable nanomon
sudo rm -f /etc/systemd/system/nanomon.service
sudo systemctl daemon-reload

# 删除程序和数据
sudo rm -rf /opt/nanomon
sudo rm -rf /var/lib/nanomon
sudo rm -f /usr/local/bin/nanomon
```

---

## �� 使用说明

### 一、管理命令

安装后可直接使用 `nanomon` 命令打开管理菜单：

```bash
nanomon
```

**菜单界面：**

```
========================================
   NanoMonitor 管理菜单 (v1.8.4)
========================================
1. 🔄 一键升级到最新版本
2. 🔄 重启服务
3. 🛑 停止服务
4. ▶️  启动服务
5. 📋 查看实时日志
6. 🔐 重置管理员密码
7. 🗑️  完全卸载
0. 退出
========================================
请选择操作 [0-7]:
```

**各选项功能说明：**

| 选项 | 功能 | 说明 |
|------|------|------|
| 1 | 一键升级 | 备份数据 → 拉取最新代码 → 恢复配置 → 重启服务 |
| 2 | 重启服务 | `systemctl restart nanomon` |
| 3 | 停止服务 | `systemctl stop nanomon`，停止监控任务释放资源 |
| 4 | 启动服务 | `systemctl start nanomon`，重新启动监控 |
| 5 | 查看日志 | `journalctl -u nanomon -f`，实时滚动显示日志 |
| 6 | 重置密码 | 生成新的随机管理员密码并立即生效 |
| 7 | 完全卸载 | 输入 `yes` 确认后删除所有程序文件和数据 |
| 0 | 退出 | 退出管理菜单 |

### 二、添加监控任务（3 步上手）

**步骤 1：访问后台**
- 浏览器打开 `http://你的服务器IP:3001/console-{随机路径}/`
- 查看服务日志获取完整地址（见上方「查看实际后台访问地址」）

**步骤 2：登录**
- 账号：`admin`
- 密码：安装或重置密码时显示的随机密码

**步骤 3：添加任务**
1. 点击界面中的「添加网站」按钮
2. 填写监控 URL（如 `https://github.com/trending`）
3. 填写任务名称（如「GitHub Trending」）
4. 设置检查间隔（秒，默认 60）
5. 保存后系统自动开始监控

### 三、查看监控结果

**任务列表页：**
- 显示所有任务的名称、URL、当前状态、上次检测时间
- `idle`（正常等待）/ `checking`（检测中）/ `error`（出错，鼠标悬停查看错误信息）
- 可执行「立即检测」强制触发一次检测，或删除任务

**变动历史页：**
- 按时间倒序展示最近 300 条变动记录
- 每条记录包含网站名称、变动摘要、检测时间
- 变动摘要格式：`🆕 [新增] 内容1 | 内容2` / `🗑️ [消失] 内容1`

**快照预览：**
- 点击任务可查看当前抓取到的文本快照（最多 300 行）
- 用于验证监控内容是否正确提取

### 四、配置 Bark 推送通知

1. 安装 [Bark APP](https://apps.apple.com/cn/app/bark-customed-notifications/id1403753865)（仅 iOS）
2. 打开 Bark，复制你的推送 Key（形如 `AbCdEfGhIjKlMnOp`）
3. 在 NanoMonitor 后台 → 「系统设置」→ 填写 Bark Key → 保存
4. 之后所有网站发生变动时，会自动推送通知到你的 iPhone

---

## 🔐 安全管理

### 查找登录信息

如果忘记了访问地址或密码，有以下两种方式查找：

**方式一：查看安装时的配置快照**
```bash
sudo cat /var/lib/nanomon/config.json
```

输出示例：
```json
{
  "port": 3000,
  "adminUser": "admin",
  "adminPass": "Ab3xK9mNpQr2",
  "accessPath": "a1b2c3d4"
}
```

> 💡 `accessPath` 即后台路径中的随机部分，完整后台访问地址为 `http://IP:3001/console-{accessPath}/`（服务器默认端口 3001）。

**方式二：查看服务启动日志**
```bash
sudo journalctl -u nanomon -n 50 --no-pager | grep -E "路径|密码|admin"
```

### 重置管理员密码

```bash
nanomon
# 选择 [6] 重置管理员密码
```

系统会生成新的随机密码并自动重启服务使其生效。

### 防火墙配置（推荐）

```bash
# Ubuntu/Debian 配置 UFW
sudo ufw allow 3001/tcp
sudo ufw limit 3001/tcp   # 限制连接频率
sudo ufw enable

# CentOS/Rocky 配置 firewalld
sudo firewall-cmd --add-port=3001/tcp --permanent
sudo firewall-cmd --reload
```

### 数据备份

```bash
# 手动备份所有数据（含配置快照和运行数据库）
# 配置快照在 /var/lib/nanomon/，数据库在 /opt/nanomon/server/monitor.db
sudo tar -czf nanomon_backup_$(date +%Y%m%d).tar.gz \
    /var/lib/nanomon/ \
    /opt/nanomon/server/monitor.db
```

---

## 🔧 故障排查

### 常用诊断命令

```bash
# 检查服务状态
sudo systemctl status nanomon

# 查看最近 100 行日志
sudo journalctl -u nanomon -n 100 --no-pager

# 实时跟踪日志
sudo journalctl -u nanomon -f

# 检查端口占用
sudo ss -tlnp | grep 3001

# 检查进程
ps aux | grep node | grep -v grep

# 查看数据库内容
sqlite3 /opt/nanomon/server/monitor.db ".tables"
sqlite3 /opt/nanomon/server/monitor.db "SELECT id, name, url, status, last_checked FROM sites;"
sqlite3 /opt/nanomon/server/monitor.db "SELECT key, value FROM settings;"
```

### 常见问题速查表

| 问题现象 | 可能原因 | 解决方案 |
|----------|----------|----------|
| 服务无法启动 | 端口被占用 | `ss -tlnp \| grep 3001` 找到占用进程后关闭 |
| 无法访问后台 | 防火墙未开放端口 | 按上方「防火墙配置」开放 3001 端口 |
| 访问后台提示 403 | 路径错误 | 查看日志确认完整路径（含 `console-` 前缀） |
| 登录失败 | 密码错误 | 用 `nanomon` 菜单选 [6] 重置密码 |
| 任务不执行 | 检查间隔未到 | 确认 `interval` 设置（单位：秒），或点击「立即检测」 |
| 抓取内容为空 | 目标网站反爬/JS 渲染慢 | 增大检查间隔，等待页面完全加载 |
| 差异过多（误报） | 动态内容未被过滤 | 这是正常现象，算法已内置多级噪音过滤 |
| 推送未收到 | Bark Key 错误或网络问题 | 验证 Bark Key，检查服务器能否访问 `api.day.app` |
| 内存持续增长 | 浏览器实例异常 | 执行 `nanomon` → [2] 重启服务 |
| Puppeteer 无法启动 | 缺少系统依赖 | 见下方「Puppeteer 依赖修复」 |

### Puppeteer 依赖修复

```bash
# Debian/Ubuntu
sudo apt-get update
sudo apt-get install -y \
    libgbm1 libasound2 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdbus-1-3 libdrm2 libgtk-3-0 libnspr4 \
    libnss3 libxkbcommon0 libxrandr2 xdg-utils \
    fonts-liberation libappindicator3-1

# CentOS/Rocky/AlmaLinux
sudo yum install -y \
    alsa-lib atk cups-libs dbus gtk3 libdrm \
    libXcomposite libXdamage libXext libXi libXtst \
    pango nss xorg-x11-fonts-Type1 xorg-x11-fonts-misc \
    libXrender libAppIndicator
```

---

## 📊 系统要求汇总

| 项目 | 要求 |
|------|------|
| 操作系统 | Ubuntu 18.04+ / Debian 9+ / CentOS 7+ / Rocky 8+ |
| Node.js | 18.x 及以上（安装脚本自动安装 20.x） |
| 内存 | 最低 512 MB，推荐 1 GB+ |
| 磁盘 | 至少 500 MB 可用空间 |
| 网络 | 需访问互联网（抓取网页 + 下载依赖） |
| 权限 | root 或 sudo 权限 |
| 默认端口 | 3001（可通过 `PORT` 环境变量修改） |

---

## 🛠️ 技术栈

- **后端**：Node.js 18+ + Express 5.x
- **前端**：React + Tailwind CSS + Framer Motion
- **浏览器**：Puppeteer 24.x（Chromium 无头模式）
- **数据库**：SQLite（better-sqlite3，WAL 模式）
- **调度**：node-cron（每分钟触发）
- **推送**：Bark（iOS 通知）
- **部署**：systemd 服务

---

## 📝 版本更新说明

### v1.8.4（最新）

**新增 / 改进：**
- ✅ 版本号更新至 v1.8.4
- ✅ 安装脚本与管理菜单版本号同步更新

### v1.7.9

**新增 / 改进：**
- ✅ 访问路径升级为 `/console-{token}` 格式，更安全
- ✅ Express 升级至 5.x
- ✅ Puppeteer 升级至 24.x
- ✅ 前端迁移至 React + Tailwind CSS + Framer Motion
- ✅ 菜单脚本扩展至 7 个功能选项（新增停止/启动/查看日志）

### v1.7.4

**修复的严重问题：**
- ✅ 浏览器实例未复用 → 已实现实例池
- ✅ cron 调度冲突 → 已添加防重叠锁
- ✅ 数据库连接未关闭 → 已优化连接管理
- ✅ 时间戳解析错误 → 已修复 ISO 格式兼容性
- ✅ API 认证脆弱 → 已添加速率限制（30 次/分钟）
- ✅ XSS 漏洞 → 已添加 diff_summary 输出转义
- ✅ SSRF 风险 → 已添加 URL 内网地址校验
- ✅ 简化安装流程为一行命令，自动生成随机账号密码
- ✅ 新增 `nanomon` 管理菜单，一键升级无需手动操作

---

## 📞 支持与反馈

- **GitHub Issues**：[提交问题](https://github.com/ctsunny/bbb/issues)
- **Discussions**：[讨论区](https://github.com/ctsunny/bbb/discussions)

---

## 📄 许可证

MIT License

---

**⚡ 一键安装：**
```bash
curl -fsSL https://raw.githubusercontent.com/ctsunny/bbb/main/install.sh | sudo bash
```

**🎯 管理命令：**
```bash
nanomon
```
