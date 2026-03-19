# ⚡ NanoMonitor (v1.7.5)

专业级 Linux VPS 网页变动监控工具。**极简部署**：一行命令安装，自动配置账号密码，开箱即用。采用 Puppeteer 无头浏览器智能抓取，具备内容去噪、差异对比、Bark 推送通知及 Web 管理面板。

---

## 🚀 极速使用指南

### 1️⃣ 一键安装（唯一推荐方式）

在您的 Linux 服务器（Ubuntu/Debian/CentOS）上执行以下命令：

```bash
curl -fsSL https://raw.githubusercontent.com/ctsunny/bbb/main/install.sh | sudo bash
```

**安装完成后会自动显示：**
- ✅ 访问地址（含随机安全路径）
- ✅ 管理员账号
- ✅ 随机生成的强密码

> 💡 **无需手动配置！无需 npm install！无需编译！**  
> 脚本会自动处理所有依赖、配置和服务注册。

---

### 2️⃣ 管理菜单

安装后已自动创建 `nanomon` 命令，随时输入：

```bash
nanomon
```

即可打开交互式管理菜单，支持：
- 🔄 一键升级到最新版本
- 🔄 重启/停止/启动服务
- 📋 查看实时日志
- 🔐 重置管理员密码
- 🗑️ 完全卸载

---

## 🆙 升级说明

### 方式一：菜单升级（推荐）

```bash
nanomon
# 选择选项 1: 一键升级到最新版本
```

### 方式二：强制升级

```bash
curl -fsSL https://raw.githubusercontent.com/ctsunny/bbb/main/install.sh | sudo bash
```

> 💡 升级会自动备份数据，无需担心丢失监控任务和历史记录。

---

## 🗑️ 卸载

### 方式一：菜单卸载（推荐）

```bash
nanomon
# 选择选项 6: 完全卸载
```

### 方式二：手动卸载

```bash
sudo systemctl stop nanomon && \
sudo systemctl disable nanomon && \
sudo rm -rf /opt/nanomon /var/lib/nanomon && \
sudo rm -f /etc/systemd/system/nanomon.service && \
sudo rm -f /usr/local/bin/nanomon && \
echo "✅ 卸载完成"
```

---

## 🔑 常见问题

### Q1: 忘记登录密码怎么办？

运行以下命令重置密码：

```bash
nanomon
# 选择选项 7: 重置管理员密码
```

或手动查看初始密码：

```bash
cat /var/lib/nanomon/config.json
```

### Q2: 无法访问面板？

1. 检查服务状态：`systemctl status nanomon`
2. 查看日志：`journalctl -u nanomon -f`
3. 确认防火墙放行 3000 端口：
   ```bash
   sudo ufw allow 3000/tcp  # Ubuntu/Debian
   sudo firewall-cmd --permanent --add-port=3000/tcp && sudo firewall-cmd --reload  # CentOS
   ```

### Q3: 如何查看实时日志？

```bash
nanomon
# 选择选项 5: 查看实时日志
```

或手动查看：

```bash
journalctl -u nanomon -f
```

### Q4: Puppeteer 浏览器启动失败？

脚本已自动安装所需系统库。如仍遇到问题，手动执行：

```bash
# Ubuntu/Debian
sudo apt-get update && sudo apt-get install -y \
    libgbm1 libasound2 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdbus-1-3 libdrm2 libgtk-3-0 libnspr4 libnss3 libxkbcommon0 \
    libxrandr2 xdg-utils

# CentOS/RHEL
sudo yum install -y \
    alsa-lib atk cups-libs dbus gtk3 libdrm libXcomposite libXdamage \
    libXext libXi libXtst pango nss xorg-x11-fonts-Type1 \
    xorg-x11-fonts-misc libXrender
```

---

## 🛡️ 安全提示

- 🔒 面板 URL 包含随机路径，请勿分享给他人
- 🔐 建议首次登录后修改默认密码
- 🌐 生产环境建议使用 Nginx 反向代理配置 HTTPS
- 🚫 不要将管理面板直接暴露在公网

---

## 📊 系统要求

- **操作系统**: Linux (Ubuntu 18.04+, Debian 9+, CentOS 7+)
- **内存**: 最低 512MB，推荐 1GB+
- **存储**: 200MB 可用空间
- **网络**: 需要访问外网以抓取目标网页

---

## 📝 技术栈

- **后端**: Node.js + Express + better-sqlite3
- **前端**: React + TailwindCSS
- **浏览器自动化**: Puppeteer
- **任务调度**: node-cron
- **数据库**: SQLite3

---

## 🤝 支持

- 📦 项目地址：[GitHub](https://github.com/ctsunny/bbb)
- 🐛 问题反馈：请在 GitHub Issues 中提交

---

## 📄 许可证

本项目采用 MIT 许可证

---

**⚠️ 重要提示**：本工具仅供合法的技术监控用途。请确保您有权监控目标网站，并遵守相关法律法规。
