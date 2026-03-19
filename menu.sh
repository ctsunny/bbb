#!/bin/bash

# NanoMonitor 管理菜单脚本
# 用途：提供简单的升级、重启、卸载、查看日志功能

set -e

INSTALL_DIR="/opt/nanomon"
DATA_DIR="/var/lib/nanomon"
SERVICE_NAME="nanomon"

show_menu() {
    clear
    echo "========================================"
    echo "   NanoMonitor 管理菜单 (v1.7.4)"
    echo "========================================"
    echo "1. 🔄 一键升级到最新版本"
    echo "2. 🔄 重启服务"
    echo "3. 🛑 停止服务"
    echo "4. ▶️  启动服务"
    echo "5. 📋 查看实时日志"
    echo "6. 🗑️  完全卸载"
    echo "7. 🔐 重置管理员密码"
    echo "0. 退出"
    echo "========================================"
    read -p "请选择操作 [0-7]: " choice
}

upgrade_service() {
    echo "正在检查更新..."
    
    # 模拟获取最新版本号 (真实场景请解析 GitHub API)
    LATEST_VERSION="v1.7.5" 
    CURRENT_VERSION="v1.7.4"
    
    echo "当前版本: $CURRENT_VERSION"
    echo "最新版本: $LATEST_VERSION"
    
    if [ "$LATEST_VERSION" == "$CURRENT_VERSION" ]; then
        echo "✅ 已是最新版本，无需升级。"
        read -p "按回车键返回菜单..."
        return
    fi
    
    read -p "确认升级到 $LATEST_VERSION ? (y/n): " confirm
    if [ "$confirm" != "y" ]; then
        echo "取消升级。"
        read -p "按回车键返回菜单..."
        return
    fi

    echo "🚀 开始升级..."
    
    # 1. 备份数据
    BACKUP_FILE="$DATA_DIR/backup_$(date +%Y%m%d_%H%M%S).tar.gz"
    echo "📦 备份数据到: $BACKUP_FILE"
    tar -czf "$BACKUP_FILE" -C "$DATA_DIR" .
    
    # 2. 停止服务
    systemctl stop $SERVICE_NAME
    
    # 3. 下载并覆盖安装 (模拟预构建包下载)
    # 真实场景: curl -L $DOWNLOAD_URL | tar xz -C $INSTALL_DIR --strip-components=1
    echo "⬇️  下载新版本 (模拟)..."
    # 这里演示用复制代替下载
    rm -rf "$INSTALL_DIR"/*
    cp -r /workspace/* "$INSTALL_DIR/"
    
    # 4. 恢复配置
    echo "⚙️  恢复配置..."
    chown -R root:root "$INSTALL_DIR"
    chmod +x "$INSTALL_DIR/start.sh"
    chmod +x "$INSTALL_DIR/menu.sh"
    
    # 5. 启动服务
    systemctl start $SERVICE_NAME
    
    echo "✅ 升级成功！已升级到 $LATEST_VERSION"
    echo "💡 提示：如果升级后出现问题，可以从 $BACKUP_FILE 恢复数据。"
    read -p "按回车键返回菜单..."
}

reset_password() {
    echo "🔐 重置管理员密码"
    NEW_PASS=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 10)
    
    # 更新配置文件
    if [ -f "$DATA_DIR/config.json" ]; then
        sed -i "s/\"adminPass\": \"[^\"]*\"/\"adminPass\": \"$NEW_PASS\"/" "$DATA_DIR/config.json"
        systemctl restart $SERVICE_NAME
        echo "✅ 密码已重置!"
        echo "新密码: $NEW_PASS"
        echo "⚠️  请立即登录修改密码!"
    else
        echo "❌ 配置文件未找到，可能未安装。"
    fi
    read -p "按回车键返回菜单..."
}

view_logs() {
    echo "📋 实时日志 (Ctrl+C 退出)..."
    journalctl -u $SERVICE_NAME -f
}

uninstall_service() {
    echo "⚠️  警告：此操作将完全卸载 NanoMonitor 并删除所有数据!"
    read -p "确认卸载？(输入 yes 确认): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "取消卸载。"
        read -p "按回车键返回菜单..."
        return
    fi
    
    systemctl stop $SERVICE_NAME
    systemctl disable $SERVICE_NAME
    rm -f /etc/systemd/system/$SERVICE_NAME.service
    systemctl daemon-reload
    rm -rf "$INSTALL_DIR"
    rm -rf "$DATA_DIR"
    rm -f /usr/local/bin/nanomon
    
    echo "✅ 卸载完成!"
    read -p "按回车键退出..."
    exit 0
}

# 主循环
while true; do
    show_menu
    case $choice in
        1) upgrade_service ;;
        2) systemctl restart $SERVICE_NAME; echo "✅ 服务已重启"; read -p "按回车键返回菜单..." ;;
        3) systemctl stop $SERVICE_NAME; echo "✅ 服务已停止"; read -p "按回车键返回菜单..." ;;
        4) systemctl start $SERVICE_NAME; echo "✅ 服务已启动"; read -p "按回车键返回菜单..." ;;
        5) view_logs ;;
        6) uninstall_service ;;
        7) reset_password ;;
        0) echo "退出."; exit 0 ;;
        *) echo "无效选项"; read -p "按回车键返回菜单..." ;;
    esac
done
