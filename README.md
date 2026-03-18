# ⚡ NanoMonitor (BWPanel Edition)

[English](#english) | [中文](#chinese)

---

<a name="chinese"></a>

## 🇨🇳 中文说明

NanoMonitor 是一款专为 Linux VPS 优化的专业级网页监控工具，参考 **BWPanel** 安全设计理念重构。它能全自动追踪网页变动并秒级推送通知。

### 🚀 1. 快速安装 (Installation)
在你的 Linux 服务器上运行以下命令即可一键部署环境：
```bash
# 克隆仓库
git clone https://github.com/ctsunny/bbb.git
cd bbb

# 快速初始化 (会自动安装 Node.js 依赖)
chmod +x menu.sh
./menu.sh
```
*在菜单中选择 `1` 即可自动执行后端与前端的依赖安装。*

### 🛠 2. 交互式配置 (Configuration)
所有配置均可通过强大的命令行菜单完成：
```bash
./menu.sh
```
- **配置推送**：选择 `7` 设置你的 Bark Key。
- **查看凭据**：选择 `3` 获取随机生成的**面板地址**、**用户名**和**安全密码**。
- **修改频率**：编辑目录下的 `.env` 文件修改 `CHECK_INTERVAL`。

### 🌐 3. 访问 Web 面板 (Web Panel)
系统会自动生成一个加密的随机路径。
1.  运行 `./menu.sh` 并按 `3`。
2.  在浏览器打开显示的 **Panel URL** (例如 `http://ip:5173/console-xxxx`)。
3.  输入显示的账号密码登录。
4.  添加你要监控的项目网址。

### 🆙 4. 系统升级 (Upgrade)
当该项目有功能更新时：
1.  运行 `./menu.sh`。
2.  选择 `2` (自动从仓库拉取最新代码并重启服务)。
*或手动执行：`git pull && npm install`*

### 🗑 5. 完整卸载 (Uninstall)
如果你不再需要本监控系统：
1.  运行 `./menu.sh`。
2.  选择 `10` (一键清理所有数据库文件、日志和安装包)。
*或手动执行：`rm -rf bbb` (删除整个项目文件夹即可)*

---

<a name="english"></a>

## 🇺🇸 English Guide

Professional web monitoring tool for Linux VPS, featuring **BWPanel** security design.

### 🚀 1. Installation
Run these commands on your Linux server:
```bash
git clone https://github.com/ctsunny/bbb.git
cd bbb
chmod +x menu.sh
./menu.sh
```
*Choose option `1` in the menu to install all dependencies.*

### 🛠 2. Configuration
Manage everything via the interactive TUI:
```bash
./menu.sh
```
- **Bark Alerts**: Use option `7` to set your Bark Token.
- **View Credentials**: Use option `3` to see your **Random Panel URL**, **User**, and **Password**.
- **Interval**: Edit `.env` to change the scraping frequency.

### 🌐 3. Web Panel Access
1.  Run `./menu.sh` and press `3`.
2.  Open the **Panel URL** in your browser (e.g., `http://ip:5173/console-xxxx`).
3.  Login with the generated credentials.

### 🆙 4. System Upgrade
To update NanoMonitor to the latest version:
1.  Run `./menu.sh`.
2.  Choose option `2` to pull the latest release and restart.
*Manual fallback: `git pull && npm install`*

### 🗑 5. Uninstallation
To completely remove the system:
1.  Run `./menu.sh`.
2.  Choose option `10` to purge all data and services.
*Manual fallback: `rm -rf bbb`*

## 🛡️ Security Note
Your dashboard is hidden behind a randomized subpath. **Do not share your Panel URL** as it contains your unique access signature.
