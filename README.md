# ⚡ NanoMonitor (v1.7.3+)

专业级 Linux VPS 网页变动监控工具。采用 GitHub Actions 云端编译（GitHub Release），无需在服务器端进行复杂的源码构建，极速部署，低占用。

---

## 🚀 1. 快速安装 (全新安装)

建议在您的 Linux 服务器（Ubuntu/Debian/CentOS）上直接运行以下指令。该脚本会自动物理清洗旧版本、下载云端预处理好的最新稳定版并启动：

```bash
cd ~ && \
pkill -f "node index.js" || true && \
rm -rf ~/bbb && \
wget -q https://github.com/ctsunny/bbb/releases/latest/download/nanomonitor-linux-x64.tar.gz -O nanomonitor.tar.gz && \
mkdir bbb && tar -xzf nanomonitor.tar.gz -C bbb && \
rm nanomonitor.tar.gz && \
cd ~/bbb/server && \
npm install --production && \
nohup node index.js > server.log 2>&1 & \
echo "✅ 极简部署完成！" && sleep 2 && \
cat server.log | head -n 15
```

---

## 🆙 2. 平滑升级 (保留数据)

如果您已经安装了旧版本且希望**保留现有的监控任务和历史记录**，请运行以下升级脚本：

```bash
cd ~ && \
pkill -f "node index.js" || true && \
# 备份数据库
cp ~/bbb/server/monitor.db ~/monitor_backup.db 2>/dev/null || true && \
# 拉取最新包并覆盖
wget -q https://github.com/ctsunny/bbb/releases/latest/download/nanomonitor-linux-x64.tar.gz -O nanomonitor.tar.gz && \
tar -xzf nanomonitor.tar.gz -C bbb --overwrite && \
# 恢复数据库并启动
cp ~/monitor_backup.db ~/bbb/server/monitor.db 2>/dev/null || true && \
cd ~/bbb/server && \
npm install --production && \
nohup node index.js > server.log 2>&1 & \
echo "✅ 平滑升级完成，数据已继承！"
```

---

## 🗑️ 3. 彻底卸载 (清除所有)

如果您不再需要此工具，运行以下命令即可清除所有文件、进程和数据库备份：

```bash
pkill -f "node index.js" || true && \
rm -rf ~/bbb ~/nanomonitor.tar.gz ~/monitor_backup.db && \
echo "✅ 所有组件已物理抹除。"
```

---

## 🔑 4. 安全、路径与密码管理

### A. 如何找回漏掉的【登录密码/管理路径】？
由于面板路径和密码是系统初次启动时随机生成的，如果您错过了控制台输出，请执行：
```bash
cat ~/bbb/server/server.log | head -n 15
```
您会看到如下格式的输出：
- **🔗 专用后台路径**: `http://您的IP:3001/console-xxxxx`
- **🔑 登 录 密 码**: `xxxxxx`

### B. 如果提示密码错误怎么办？
1. **核对空格**：请确保复制密码时没有多选一个空格。
2. **强制重置密码**：如果确定密码失效，进入服务器目录并执行以下命令将密码强制修改为 `admin123`：
   ```bash
   cd ~/bbb/server && node -e "const db=require('./db'); db.prepare('UPDATE settings SET value=? WHERE key=?').run('admin123', 'admin_pass'); console.log('密码已重置为: admin123');"
   ```
   *(执行后刷新页面，直接用 `admin123` 登录即可)*

### C. 无法访问页面 (403 Forbidden)？
- 请确保 URL 结尾带有 `/` 或完整的安全随机后缀。
- 检查服务器防火墙（UFW/iptables）是否放行了 `3001` 端口。

---

## 🛡️ 安全提示
请勿在公开场合分享您的面板 URL。该 URL 的随机后缀是您系统的唯一访问签名。
