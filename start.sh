#!/bin/bash

# NanoMonitor 启动脚本
# 用途：作为 systemd 服务的入口，启动 Node.js 应用

set -e

INSTALL_DIR="/opt/nanomon"
DATA_DIR="${DATA_DIR:-/var/lib/nanomon}"

cd "$INSTALL_DIR"

# 设置环境变量
export NODE_ENV=production
export DATA_DIR="$DATA_DIR"

# 启动应用 (假设主程序是 app.js 或 server.js)
exec node server/index.js
