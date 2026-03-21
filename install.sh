#!/bin/bash

# BWPanel 一键安装脚本
# 下载预编译二进制，自动生成配置，systemd 托管
# 管理命令：bwpanel-menu

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 配置变量
DATA_DIR="/opt/bwtest"
BINARY="/usr/local/bin/bwpanel"
SERVICE_NAME="bwpanel"
CONF_FILE="$DATA_DIR/bwpanel.conf"
DB_FILE="$DATA_DIR/bwtest.db"
RELEASE_REPO="ctsunny/bwtest"
MENU_SCRIPT="/usr/local/bin/bwpanel-menu"

echo -e "${BLUE}====================================${NC}"
echo -e "${BLUE}   BWPanel 一键安装脚本            ${NC}"
echo -e "${BLUE}====================================${NC}"
echo ""

# 检查是否以 root 运行
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}错误：请使用 root 用户运行此脚本${NC}"
  echo -e "${YELLOW}示例：curl -fsSL https://raw.githubusercontent.com/ctsunny/bbb/main/install.sh | sudo bash${NC}"
  exit 1
fi

# 安装基础依赖
if command -v apt-get &>/dev/null; then
    apt-get update -qq >/dev/null 2>&1
    apt-get install -y -qq curl wget ca-certificates >/dev/null 2>&1 || true
elif command -v yum &>/dev/null; then
    yum install -y -q curl wget ca-certificates >/dev/null 2>&1 || true
fi

# 检测系统架构
ARCH=$(uname -m)
case "$ARCH" in
    x86_64)  BIN_ARCH="amd64" ;;
    aarch64) BIN_ARCH="arm64" ;;
    armv7l)  BIN_ARCH="arm" ;;
    *)       BIN_ARCH="amd64" ;;
esac

# 查询最新版本
echo -e "${YELLOW}[INFO] 查询 GitHub 最新 Release...${NC}"
LATEST_VER=$(curl -s --connect-timeout 15 -H 'User-Agent: bwpanel-installer' \
    "https://api.github.com/repos/${RELEASE_REPO}/releases/latest" \
    | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')
if [ -z "$LATEST_VER" ]; then
    echo -e "${RED}无法获取最新版本，请检查网络连接${NC}"
    exit 1
fi
echo -e "最新版本: ${GREEN}${LATEST_VER}${NC}"

# 下载预编译二进制
BIN_URL="https://github.com/${RELEASE_REPO}/releases/download/${LATEST_VER}/bwpanel-linux-${BIN_ARCH}"
echo -e "${YELLOW}[INFO] 下载二进制: ${BIN_URL}${NC}"
if ! wget -q -O "$BINARY.tmp" "$BIN_URL"; then
    echo -e "${RED}下载失败，请检查网络连接${NC}"
    rm -f "$BINARY.tmp"
    exit 1
fi
mv -f "$BINARY.tmp" "$BINARY"
chmod +x "$BINARY"
echo -e "${GREEN}[INFO] 二进制下载成功${NC}"

# 创建数据目录
mkdir -p "$DATA_DIR"

# 生成初始配置（仅首次安装时）
if [ ! -f "$CONF_FILE" ]; then
    _free_port() {
        local p
        p=$(shuf -i 30000-49999 -n 1)
        while ss -tlnH "sport = :${p}" 2>/dev/null | grep -q .; do
            p=$(shuf -i 30000-49999 -n 1)
        done
        echo "$p"
    }
    PANEL_PORT=$(_free_port)
    DATA_PORT=$(_free_port)
    while [ "$DATA_PORT" -eq "$PANEL_PORT" ]; do
        DATA_PORT=$(_free_port)
    done
    PANEL_PATH=$(openssl rand -hex 4)
    ADMIN_PASS=$(openssl rand -hex 12)
    REG_TOKEN=$(openssl rand -hex 20)
    BARK_URL=""

    cat > "$CONF_FILE" <<EOF
PANEL_PORT=${PANEL_PORT}
DATA_PORT=${DATA_PORT}
PANEL_PATH=${PANEL_PATH}
ADMIN_PASS=${ADMIN_PASS}
REG_TOKEN=${REG_TOKEN}
BARK_URL=${BARK_URL}
EOF
    chmod 600 "$CONF_FILE"
    echo -e "${GREEN}[INFO] 已生成初始配置${NC}"
else
    echo -e "${CYAN}[INFO] 使用已有配置${NC}"
fi

# 读取配置
# shellcheck source=/dev/null
. "$CONF_FILE"

# 注册 systemd 服务
_build_execstart() {
    local cmd="$BINARY"
    cmd="$cmd -panel :${PANEL_PORT}/console-${PANEL_PATH}"
    cmd="$cmd -data :${DATA_PORT}"
    cmd="$cmd -db ${DB_FILE}"
    cmd="$cmd -pass ${ADMIN_PASS}"
    cmd="$cmd -token ${REG_TOKEN}"
    if [ -n "$BARK_URL" ]; then
        cmd="$cmd -bark ${BARK_URL}"
    fi
    echo "$cmd"
}

EXEC_START=$(_build_execstart)

cat > /etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=Bandwidth Test Panel
After=network.target

[Service]
Type=simple
User=root
ExecStart=${EXEC_START}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload >/dev/null 2>&1
systemctl enable "$SERVICE_NAME" >/dev/null 2>&1

# 停止旧实例（升级场景）
systemctl stop "$SERVICE_NAME" 2>/dev/null || true
sleep 1
systemctl start "$SERVICE_NAME"
sleep 3

# 获取本机 IP
IP_ADDR=$(curl -s --connect-timeout 10 ifconfig.me 2>/dev/null \
    || curl -s --connect-timeout 10 api.ipify.org 2>/dev/null \
    || hostname -I | awk '{print $1}')

# 安装管理菜单脚本
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/menu.sh" ]; then
    cp -f "$SCRIPT_DIR/menu.sh" "$MENU_SCRIPT"
    chmod +x "$MENU_SCRIPT"
else
    # 从仓库下载 menu.sh
    wget -q -O "$MENU_SCRIPT" \
        "https://raw.githubusercontent.com/ctsunny/bbb/main/menu.sh" 2>/dev/null \
        && chmod +x "$MENU_SCRIPT" || true
fi

echo ""
systemctl status "$SERVICE_NAME" --no-pager 2>/dev/null || true
echo -e "${GREEN}[INFO] 安装完成！${NC}"
echo ""
echo -e "  面板地址   : ${CYAN}http://${IP_ADDR}:${PANEL_PORT}/console-${PANEL_PATH}${NC}"
echo -e "  用户名    : ${CYAN}admin${NC}"
echo -e "  密码      : ${CYAN}${ADMIN_PASS}${NC}"
echo -e "  注册Token : ${CYAN}${REG_TOKEN}${NC}"
if [ -n "$BARK_URL" ]; then
    echo -e "  Bark URL  : ${CYAN}${BARK_URL}${NC}"
fi
echo -e "  常用命令   : ${YELLOW}systemctl status bwpanel  |  journalctl -u bwpanel -f${NC}"
echo -e "  管理脚本   : ${YELLOW}bwpanel-menu${NC}"
echo ""
