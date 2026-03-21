#!/bin/bash

# BWPanel 管理菜单脚本
# 管理命令：bwpanel-menu

DATA_DIR="/opt/bwtest"
BINARY="/usr/local/bin/bwpanel"
SERVICE_NAME="bwpanel"
CONF_FILE="$DATA_DIR/bwpanel.conf"
DB_FILE="$DATA_DIR/bwtest.db"
RELEASE_REPO="ctsunny/bwtest"
MENU_SCRIPT="/usr/local/bin/bwpanel-menu"

# 读取配置文件
_load_conf() {
    if [ -f "$CONF_FILE" ]; then
        # shellcheck source=/dev/null
        . "$CONF_FILE"
    fi
}

# 保存单个配置项
_set_conf() {
    local key="$1"
    local val="$2"
    if grep -q "^${key}=" "$CONF_FILE" 2>/dev/null; then
        sed -i "s|^${key}=.*|${key}=${val}|" "$CONF_FILE"
    else
        echo "${key}=${val}" >> "$CONF_FILE"
    fi
}

# 重建完整 systemd 服务文件并重启
_reload_service() {
    _load_conf
    local exec_start="$BINARY"
    exec_start="$exec_start -panel :${PANEL_PORT}/console-${PANEL_PATH}"
    exec_start="$exec_start -data :${DATA_PORT}"
    exec_start="$exec_start -db ${DB_FILE}"
    exec_start="$exec_start -pass ${ADMIN_PASS}"
    exec_start="$exec_start -token ${REG_TOKEN}"
    if [ -n "$BARK_URL" ]; then
        exec_start="$exec_start -bark ${BARK_URL}"
    fi

    cat > /etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=Bandwidth Test Panel
After=network.target

[Service]
Type=simple
User=root
ExecStart=${exec_start}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload >/dev/null 2>&1
    systemctl restart "$SERVICE_NAME" >/dev/null 2>&1
}

# 显示当前配置信息
_show_info() {
    _load_conf
    local ip
    ip=$(curl -s --connect-timeout 10 ifconfig.me 2>/dev/null \
        || curl -s --connect-timeout 10 api.ipify.org 2>/dev/null \
        || hostname -I | awk '{print $1}')
    echo ""
    echo "  面板地址   : http://${ip}:${PANEL_PORT}/console-${PANEL_PATH}"
    echo "  用户名    : admin"
    echo "  密码      : ${ADMIN_PASS}"
    echo "  注册Token : ${REG_TOKEN}"
    if [ -n "$BARK_URL" ]; then
        echo "  Bark URL  : ${BARK_URL}"
    fi
    echo "  常用命令   : systemctl status bwpanel  |  journalctl -u bwpanel -f"
    echo "  管理脚本   : bwpanel-menu"
    echo ""
}

show_menu() {
    clear
    echo "======== BWPanel 管理菜单 ========"
    echo "  1. 安装 / 重新安装服务端"
    echo "  2. 升级（自动拉取最新 Release）"
    echo "  3. 查看当前配置与面板地址"
    echo "  4. 重置管理员密码"
    echo "  5. 重置面板访问路径"
    echo "  6. 重置客户端注册 Token"
    echo "  7. 配置 Bark 推送"
    echo "  8. 查看服务状态与日志"
    echo "  9. 重启服务"
    echo " 10. 完整卸载"
    echo " 11. 生成客户端安装命令"
    echo "  0. 退出"
    echo "===================================="
    read -rp "请选择操作 [0-11]: " choice
}

do_install() {
    echo ""
    echo "=== 安装 / 重新安装 BWPanel ==="
    local script_url="https://raw.githubusercontent.com/ctsunny/bbb/main/install.sh"
    if curl -fsSL --connect-timeout 30 "$script_url" | bash; then
        echo "[INFO] 安装完成！"
    else
        echo "[ERROR] 安装脚本执行失败，请检查网络连接"
    fi
    read -rp "按回车键返回菜单..."
}

do_upgrade() {
    echo ""
    echo "=== 升级 BWPanel ==="

    # 当前版本
    local cur_ver=""
    if [ -x "$BINARY" ]; then
        cur_ver=$("$BINARY" -version 2>/dev/null | grep -oP 'v[\d.]+' | head -1 || true)
    fi
    [ -z "$cur_ver" ] && cur_ver="(未知)"
    echo "当前版本: ${cur_ver}"

    # 查询最新版本
    echo "[INFO] 查询 GitHub 最新 Release..."
    local latest_ver
    latest_ver=$(curl -s --connect-timeout 15 -H 'User-Agent: bwpanel-menu' \
        "https://api.github.com/repos/${RELEASE_REPO}/releases/latest" \
        | grep '"tag_name"' | head -1 \
        | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')
    if [ -z "$latest_ver" ]; then
        echo "[ERROR] 无法获取最新版本，请检查网络连接"
        read -rp "按回车键返回菜单..."
        return
    fi
    echo "最新版本: ${latest_ver}"

    read -rp "目标版本 [回车使用 ${latest_ver}]: " target_ver
    [ -z "$target_ver" ] && target_ver="$latest_ver"

    # 检测架构
    local arch
    arch=$(uname -m)
    local bin_arch
    case "$arch" in
        x86_64)  bin_arch="amd64" ;;
        aarch64) bin_arch="arm64" ;;
        armv7l)  bin_arch="arm" ;;
        *)       bin_arch="amd64" ;;
    esac

    local bin_url="https://github.com/${RELEASE_REPO}/releases/download/${target_ver}/bwpanel-linux-${bin_arch}"
    echo "[INFO] 尝试从 Release 下载预编译二进制..."
    if wget -q -O "${BINARY}.tmp" "$bin_url"; then
        mv -f "${BINARY}.tmp" "$BINARY"
        chmod +x "$BINARY"
        echo "[INFO] Release 下载成功 (${bin_url})"
    else
        rm -f "${BINARY}.tmp"
        echo "[ERROR] 下载失败，请检查版本号或网络连接"
        read -rp "按回车键返回菜单..."
        return
    fi

    # 重启服务
    systemctl restart "$SERVICE_NAME" >/dev/null 2>&1
    sleep 2
    systemctl status "$SERVICE_NAME" --no-pager 2>/dev/null || true
    echo "[INFO] 升级完成！"
    _show_info
    read -rp "按回车键返回菜单..."
}

do_show_config() {
    echo ""
    echo "=== 当前配置与面板地址 ==="
    _show_info
    read -rp "按回车键返回菜单..."
}

do_reset_password() {
    echo ""
    echo "=== 重置管理员密码 ==="
    local new_pass
    new_pass=$(openssl rand -hex 12)
    _set_conf "ADMIN_PASS" "$new_pass"
    _reload_service
    echo "新密码: ${new_pass}"
    echo "[INFO] 密码已重置，服务已重启"
    read -rp "按回车键返回菜单..."
}

do_reset_path() {
    echo ""
    echo "=== 重置面板访问路径 ==="
    local new_path
    new_path=$(openssl rand -hex 4)
    _set_conf "PANEL_PATH" "$new_path"
    _reload_service
    _load_conf
    local ip
    ip=$(curl -s --connect-timeout 10 ifconfig.me 2>/dev/null \
        || hostname -I | awk '{print $1}')
    echo "新面板地址: http://${ip}:${PANEL_PORT}/console-${new_path}"
    echo "[INFO] 访问路径已重置，服务已重启"
    read -rp "按回车键返回菜单..."
}

do_reset_token() {
    echo ""
    echo "=== 重置客户端注册 Token ==="
    local new_token
    new_token=$(openssl rand -hex 20)
    _set_conf "REG_TOKEN" "$new_token"
    _reload_service
    echo "新注册Token: ${new_token}"
    echo "[INFO] 注册 Token 已重置，服务已重启"
    read -rp "按回车键返回菜单..."
}

do_bark_config() {
    echo ""
    echo "=== 配置 Bark 推送 ==="
    _load_conf
    echo "当前 Bark URL: ${BARK_URL:-(未配置)}"
    echo "格式示例: https://api.day.app/YourBarkKey"
    echo "（留空则清除 Bark 配置）"
    read -rp "输入新的 Bark URL: " new_bark
    _set_conf "BARK_URL" "$new_bark"
    _reload_service
    if [ -n "$new_bark" ]; then
        echo "[INFO] Bark URL 已更新，服务已重启"
    else
        echo "[INFO] Bark 推送已关闭，服务已重启"
    fi
    read -rp "按回车键返回菜单..."
}

do_service_status() {
    echo ""
    echo "=== 服务状态与日志 ==="
    systemctl status "$SERVICE_NAME" --no-pager 2>/dev/null || true
    echo ""
    echo "--- 最近日志 (最新20行) ---"
    journalctl -u "$SERVICE_NAME" -n 20 --no-pager 2>/dev/null || true
    echo ""
    read -rp "按回车键返回菜单..."
}

do_restart() {
    echo ""
    systemctl restart "$SERVICE_NAME" >/dev/null 2>&1 \
        && echo "[INFO] 服务已重启" \
        || echo "[ERROR] 重启失败，请检查 journalctl -u ${SERVICE_NAME}"
    read -rp "按回车键返回菜单..."
}

do_uninstall() {
    echo ""
    echo "=== 完整卸载 BWPanel ==="
    echo "警告：此操作将停止服务、删除二进制和配置文件！"
    read -rp "确认卸载？(输入 yes 确认): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "取消卸载"
        read -rp "按回车键返回菜单..."
        return
    fi

    systemctl stop "$SERVICE_NAME" 2>/dev/null || true
    systemctl disable "$SERVICE_NAME" 2>/dev/null || true
    rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
    systemctl daemon-reload >/dev/null 2>&1
    rm -f "$BINARY"
    rm -f "$MENU_SCRIPT"
    rm -rf "$DATA_DIR"

    echo "[INFO] 卸载完成！"
    read -rp "按回车键退出..."
    exit 0
}

do_gen_client_cmd() {
    echo ""
    echo "=== 生成客户端安装命令 ==="
    _load_conf
    local ip
    ip=$(curl -s --connect-timeout 10 ifconfig.me 2>/dev/null \
        || curl -s --connect-timeout 10 api.ipify.org 2>/dev/null \
        || hostname -I | awk '{print $1}')
    echo ""
    echo "在客户端机器上执行以下命令："
    echo ""
    echo "  curl -fsSL https://raw.githubusercontent.com/ctsunny/bwtest/main/install-client.sh | bash -s -- \\"
    echo "    --server ${ip}:${DATA_PORT} \\"
    echo "    --token ${REG_TOKEN}"
    echo ""
    read -rp "按回车键返回菜单..."
}

# 主循环
while true; do
    show_menu
    case $choice in
        1)  do_install ;;
        2)  do_upgrade ;;
        3)  do_show_config ;;
        4)  do_reset_password ;;
        5)  do_reset_path ;;
        6)  do_reset_token ;;
        7)  do_bark_config ;;
        8)  do_service_status ;;
        9)  do_restart ;;
        10) do_uninstall ;;
        11) do_gen_client_cmd ;;
        0)  echo "退出."; exit 0 ;;
        *)  echo "无效选项"; read -rp "按回车键返回菜单..." ;;
    esac
done
