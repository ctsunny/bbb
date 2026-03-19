# NanoMonitor - 极简网页变动监控工具 🚀

**一行命令安装 · 自动生成账号密码 · 菜单式管理**

[![Version](https://img.shields.io/badge/version-v1.7.4-blue.svg)](https://github.com/ctsunny/bbb)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 📖 项目简介

NanoMonitor 是一个轻量级 Linux VPS 网页变动监控工具，使用 Puppeteer 无头浏览器定期抓取网页，通过智能算法过滤噪音后对比内容变化，支持 Bark 推送通知和 Web 管理面板。

### ✨ 核心特性

- **极简部署**：一行命令完成安装，无需手动配置
- **自动账号**：安装时自动生成随机账号密码和安全访问路径
- **菜单管理**：`nanomon` 命令打开管理菜单，支持一键升级、重启、查看日志
- **智能监控**：自动过滤广告、时间戳等噪音，精准识别内容变化
- **实时推送**：支持 Bark 推送，第一时间获知变动
- **资源友好**：浏览器实例复用，内存占用低

---

## 🚀 快速开始

### 一键安装（推荐）

```bash
curl -fsSL https://raw.githubusercontent.com/ctsunny/bbb/main/install.sh | sudo bash
```

**安装完成后会自动显示：**
- 📍 访问地址（含随机安全路径）
- 👤 管理员账号
- 🔑 随机生成的密码

**请立即保存上述信息！**

### 管理命令

安装后可直接使用 `nanomon` 命令打开管理菜单：

```bash
nanomon
```

菜单功能：
```
========================================
   NanoMonitor 管理菜单 (v1.7.4)
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
```

---

## 🆙 升级教程

### 方式一：菜单升级（推荐）

```bash
nanomon
# 选择 [1] 一键升级
```

系统会自动：
1. 备份当前数据
2. 拉取最新代码
3. 恢复配置
4. 重启服务

### 方式二：重新运行安装脚本

```bash
curl -fsSL https://raw.githubusercontent.com/ctsunny/bbb/main/install.sh | sudo bash
```

安装脚本会自动检测旧版本并保留配置。

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
# 停止并删除服务
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

## 🔐 安全管理

### 找回登录信息

如果忘记了访问地址或密码：

```bash
# 查看配置文件
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

访问地址：`http://你的IP:3000/a1b2c3d4`

### 强制重置密码

```bash
nanomon
# 选择 [6] 重置管理员密码
```

系统会生成新的随机密码并立即生效。

---

## 🔧 常见问题

### 1. 服务无法启动

```bash
# 查看服务状态
sudo systemctl status nanomon

# 查看详细日志
sudo journalctl -u nanomon -n 50

# 尝试重启
sudo systemctl restart nanomon
```

### 2. Puppeteer 浏览器无法启动

```bash
# 安装缺失的依赖
sudo apt-get update
sudo apt-get install -y \
    libgbm1 libasound2 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdbus-1-3 libdrm2 libgtk-3-0 libnspr4 \
    libnss3 libxkbcommon0 libxrandr2 xdg-utils \
    fonts-liberation libappindicator3-1
```

### 3. 内存占用过高

NanoMonitor 已优化浏览器实例复用，正常情况下内存占用约 200-400MB。如仍过高：

```bash
# 查看内存使用
ps aux | grep nanomon | grep -v grep

# 重启服务释放内存
sudo systemctl restart nanomon
```

### 4. 监控任务不执行

```bash
# 检查日志
sudo journalctl -u nanomon -f

# 检查数据库
sqlite3 /var/lib/nanomon/nanomon.db "SELECT * FROM tasks;"
```

---

## 📊 系统要求

- **操作系统**: Ubuntu 18.04+ / Debian 9+ / CentOS 7+
- **内存**: 最低 512MB，推荐 1GB+
- **磁盘**: 至少 500MB 可用空间
- **网络**: 需要访问互联网以抓取网页和下载依赖
- **权限**: 需要 root 或 sudo 权限

---

## 🛠️ 技术栈

- **后端**: Node.js + Express
- **前端**: Vue 3 + Element Plus
- **浏览器**: Puppeteer (Chromium)
- **数据库**: SQLite
- **调度**: node-cron
- **部署**: systemd

---

## 📝 版本更新说明

### v1.7.4 (2024)

**修复的严重问题：**
- ✅ 浏览器实例未复用 → 已实现实例池
- ✅ cron 调度冲突 → 已添加防重叠锁
- ✅ 数据库连接未关闭 → 已优化连接管理
- ✅ 时间戳解析错误 → 已修复兼容性
- ✅ API 认证脆弱 → 已添加速率限制
- ✅ XSS 漏洞 → 已添加输入转义
- ✅ SSRF 风险 → 已添加 URL 验证
- ✅ Bark URL 硬编码 → 已改为可配置

**改进：**
- 简化安装流程为一行命令
- 自动生成随机账号密码
- 新增 `nanomon` 管理菜单
- 一键升级无需手动操作

---

## 📞 支持与反馈

- **GitHub Issues**: [提交问题](https://github.com/ctsunny/bbb/issues)
- ** Discussions**: [讨论区](https://github.com/ctsunny/bbb/discussions)

---

## 📄 许可证

MIT License

---

**⚡ 快速开始：**
```bash
curl -fsSL https://raw.githubusercontent.com/ctsunny/bbb/main/install.sh | sudo bash
```

**🎯 管理命令：**
```bash
nanomon
```
