#!/bin/bash

# NanoMonitor 管理菜单脚本 (v1.7.9)
# 极简设计：一键升级、重启、查看日志、重置密码、卸载

INSTALL_DIR="/opt/nanomon"
DATA_DIR="/var/lib/nanomon"
SERVICE_NAME="nanomon"
REPO_URL="https://github.com/ctsunny/bbb.git"
BRANCH="main"

show_menu() {
    clear
    echo "========================================"
    echo "   NanoMonitor 管理菜单 (v1.7.9)"
    echo "========================================"
    echo "1. 🔄 一键升级到最新版本"
    echo "2. 🔄 重启服务"
    echo "3. 🛑 停止服务"
    echo "4. ▶️  启动服务"
    echo "5. 📋 查看实时日志"
    echo "6. 🔐 重置管理员密码"
    echo "7. 🗑️  完全卸载"
    echo "0. 退出"
    echo "========================================"
    read -p "请选择操作 [0-7]: " choice
}

upgrade_service() {
    echo ""
    echo "🔄 正在检查更新..."
    
    cd "$INSTALL_DIR"
    
    # 备份当前配置
    BACKUP_FILE="$DATA_DIR/backup_$(date +%Y%m%d_%H%M%S).tar.gz"
    echo "📦 备份数据到：$BACKUP_FILE"
    tar -czf "$BACKUP_FILE" -C "$DATA_DIR" . 2>/dev/null || true
    
    # 拉取最新代码
    echo "⬇️  拉取最新代码..."
    git fetch origin "$BRANCH" >/dev/null 2>&1
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/"$BRANCH" 2>/dev/null || echo "")
    
    if [ -z "$REMOTE" ]; then
        echo "❌ 无法获取远程版本，请检查网络连接"
        read -p "按回车键返回菜单..."
        return
    fi
    
    if [ "$LOCAL" = "$REMOTE" ]; then
        echo "✅ 已是最新版本，无需升级"
        read -p "按回车键返回菜单..."
        return
    fi
    
    echo "发现新版本，开始升级..."
    
    # 停止服务
    systemctl stop $SERVICE_NAME 2>/dev/null || true
    
    # 拉取并重置到最新
    git pull origin "$BRANCH" >/dev/null 2>&1
    git reset --hard origin/"$BRANCH" >/dev/null 2>&1
    
    # 重新安装 Node.js 依赖（确保原生模块与当前 Node.js 版本匹配）
    echo "📦 更新 Node.js 依赖..."
    cd "$INSTALL_DIR/server"
    if ! npm install --production --no-audit --no-fund >/dev/null 2>&1; then
        echo "⚠️  npm install 失败，服务可能无法正常启动"
    fi
    cd "$INSTALL_DIR"
    
    # 恢复配置
    if [ -f "$DATA_DIR/.env.backup" ]; then
        cp -f "$DATA_DIR/.env.backup" "$INSTALL_DIR/.env" 2>/dev/null || true
    fi
    
    # 设置权限
    chmod +x "$INSTALL_DIR/start.sh" 2>/dev/null || true
    chmod +x "$INSTALL_DIR/menu.sh" 2>/dev/null || true
    
    # 启动服务
    systemctl start $SERVICE_NAME >/dev/null 2>&1
    
    echo ""
    echo "✅ 升级成功！"
    echo "💡 备份文件：$BACKUP_FILE"
    read -p "按回车键返回菜单..."
}

reset_password() {
    echo ""
    echo "🔐 重置管理员密码"
    
    if [ ! -f "$DATA_DIR/config.json" ]; then
        echo "❌ 配置文件未找到"
        read -p "按回车键返回菜单..."
        return
    fi
    
    NEW_PASS=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 12)
    
    # 使用更安全的 sed 转义
    ESCAPED_PASS=$(printf '%s\n' "$NEW_PASS" | sed 's/[&/\]/\\&/g')
    sed -i "s/\"adminPass\": \"[^\"]*\"/\"adminPass\": \"$ESCAPED_PASS\"/" "$DATA_DIR/config.json"
    
    systemctl restart $SERVICE_NAME >/dev/null 2>&1
    
    echo ""
    echo "✅ 密码已重置!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "新密码：$NEW_PASS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⚠️  请立即登录修改密码!"
    read -p "按回车键返回菜单..."
}

view_logs() {
    echo ""
    echo "📋 实时日志 (Ctrl+C 退出)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    journalctl -u $SERVICE_NAME -f --no-pager 2>/dev/null || tail -f /var/log/syslog 2>/dev/null || echo "日志不可用"
}

uninstall_service() {
    echo ""
    echo "⚠️  警告：此操作将完全卸载 NanoMonitor 并删除所有数据!"
    echo ""
    read -p "确认卸载？(输入 yes 确认): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "取消卸载"
        read -p "按回车键返回菜单..."
        return
    fi
    
    systemctl stop $SERVICE_NAME 2>/dev/null || true
    systemctl disable $SERVICE_NAME 2>/dev/null || true
    rm -f /etc/systemd/system/$SERVICE_NAME.service
    systemctl daemon-reload >/dev/null 2>&1
    rm -rf "$INSTALL_DIR"
    rm -rf "$DATA_DIR"
    rm -f /usr/local/bin/nanomon
    
    echo ""
    echo "✅ 卸载完成!"
    read -p "按回车键退出..."
    exit 0
}

# 主循环
while true; do
    show_menu
    case $choice in
        1) upgrade_service ;;
        2) systemctl restart $SERVICE_NAME >/dev/null 2>&1 && echo "✅ 服务已重启" || echo "❌ 重启失败"; read -p "按回车键返回菜单..." ;;
        3) systemctl stop $SERVICE_NAME >/dev/null 2>&1 && echo "✅ 服务已停止" || echo "❌ 停止失败"; read -p "按回车键返回菜单..." ;;
        4) systemctl start $SERVICE_NAME >/dev/null 2>&1 && echo "✅ 服务已启动" || echo "❌ 启动失败"; read -p "按回车键返回菜单..." ;;
        5) view_logs ;;
        6) reset_password ;;
        7) uninstall_service ;;
        0) echo "退出."; exit 0 ;;
        *) echo "无效选项"; read -p "按回车键返回菜单..." ;;
    esac
done
