#!/bin/bash

# NanoMonitor / BWPanel 管理脚本 - 中文版

# 颜色控制
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # 无颜色

SERVER_DIR="$(cd "$(dirname "$0")/server" && pwd)"
DB_PATH="$SERVER_DIR/monitor.db"

# --- 功能函数 ---
get_setting() {
    sqlite3 "$DB_PATH" "SELECT value FROM settings WHERE key = '$1';"
}

update_setting() {
    sqlite3 "$DB_PATH" "REPLACE INTO settings (key, value) VALUES ('$1', '$2');"
}

show_config() {
    clear
    echo -e "${BLUE}=== 当前面板配置信息 ===${NC}"
    
    local USER=$(get_setting "admin_user")
    local PASS=$(get_setting "admin_pass")
    local PATH_SUB=$(get_setting "access_path")
    local TOKEN=$(get_setting "reg_token")
    local BARK=$(get_setting "bark_key")
    local IP=$(curl -s ifconfig.me)

    echo -e "面板地址    : ${YELLOW}http://$IP:5173/console-$PATH_SUB${NC}"
    echo -e "用户名      : ${GREEN}$USER${NC}"
    echo -e "登录密码    : ${RED}$PASS${NC}"
    echo -e "访问令牌    : ${BLUE}$TOKEN${NC}"
    echo -e "Bark 推送   : ${BARK:-'未配置'}"
    echo -e "常用命令    : systemctl status monitor | journalctl -u monitor -f"
    echo -e "管理快捷键  : monitor-menu"
    echo "==================================="
    read -p "按任意键返回菜单..." -n1 -s
}

reset_pass() {
    local NEW_PASS=$(LC_ALL=C tr -dc 'a-zA-Z0-9' < /dev/urandom | fold -w 8 | head -n 1)
    update_setting "admin_pass" "$NEW_PASS"
    echo -e "${GREEN}密码重置成功: $NEW_PASS${NC}"
    sleep 2
}

reset_token() {
    local NEW_TOKEN=$(openssl rand -hex 16)
    update_setting "reg_token" "$NEW_TOKEN"
    echo -e "${GREEN}访问令牌重置成功: $NEW_TOKEN${NC}"
    sleep 2
}

reset_path() {
    local NEW_PATH=$(openssl rand -hex 8)
    update_setting "access_path" "$NEW_PATH"
    echo -e "${GREEN}访问路径重置成功: console-$NEW_PATH${NC}"
    sleep 2
}

config_bark() {
    read -p "请输入 Bark Key: " BARK_KEY
    if [ ! -z "$BARK_KEY" ]; then
        update_setting "bark_key" "$BARK_KEY"
        echo -e "${GREEN}Bark 推送配置已更新！${NC}"
    fi
    sleep 2
}

# --- 主菜单 ---
main_menu() {
    while true; do
        clear
        echo "======== NanoMonitor 管理菜单 (BWPanel 版) ========"
        echo " 1. 安装 / 重新安装服务端 (依赖环境)"
        echo " 2. 升级系统 (自动拉取最新 Release)"
        echo " 3. 查看当前配置与面板地址"
        echo " 4. 重置管理员密码"
        echo " 5. 重置面板访问路径 (子目录)"
        echo " 6. 重置客户端注册 Token"
        echo " 7. 配置 Bark 推送推送"
        echo " 8. 查看服务运行状态与日志"
        echo " 9. 重启监控服务"
        echo " 10. 完整卸载监控系统"
        echo " 11. 生成 'monitor' 快捷启动命令"
        echo " 0. 退出脚本"
        echo "================================================="
        read -p "请选择操作 [0-11]: " opt
        
        case $opt in
            1) 
                echo -e "${YELLOW}正在安装/重装依赖 (Server & Client)...${NC}"
                (cd server && npm install)
                (cd client && npm install)
                echo -e "${GREEN}依赖安装完成！正在尝试启动初始环境...${NC}"
                if [ -f server/index.js ]; then
                   node server/index.js > /dev/null 2>&1 &
                   echo "服务端已在后台启动。"
                fi
                sleep 3
                ;;
            2) 
                echo -e "${YELLOW}正在从 GitHub 拉取代码...${NC}"
                git pull
                (cd server && npm install)
                (cd client && npm install)
                echo -e "${GREEN}系统已更新，正在尝试重启服务...${NC}"
                systemctl restart monitor 2>/dev/null || pm2 restart monitor 2>/dev/null || echo "请手动重启服务。"
                sleep 2
                ;;
            3) show_config ;;
            4) reset_pass ;;
            5) reset_path ;;
            6) reset_token ;;
            7) config_bark ;;
            8) 
                echo -e "${BLUE}正在查看实时日志 (按 Ctrl+C 退出)...${NC}"
                journalctl -u monitor -f 2>/dev/null || tail -f server/logs.log 2>/dev/null || echo "未找到日志文件。"
                sleep 1 
                ;;
            9) 
                echo -e "${YELLOW}正在重启监控服务...${NC}"
                systemctl restart monitor 2>/dev/null || pm2 restart monitor 2>/dev/null || echo "重启失败，请检查服务安装情况。"
                sleep 2
                ;;
            10) 
                read -p "确定要卸载吗？所有监控数据将丢失！ [y/N]: " confirm
                if [[ "$confirm" == "y" || "$confirm" == "Y" ]]; then
                    echo -e "${RED}正在执行卸载...${NC}"
                    rm "$DB_PATH"
                    echo -e "${YELLOW}数据库已清理，请手动删除 'bbb' 文件夹完成卸载。${NC}"
                    exit 0
                fi
                ;;
            11) 
                echo "alias monitor='cd $(pwd) && ./menu.sh'" >> ~/.bashrc
                echo -e "${GREEN}快捷命令 'monitor' 已创建！请执行 'source ~/.bashrc' 或重新进入终端。${NC}"
                sleep 2
                ;;
            0) exit 0 ;;
            *) echo -e "${RED}输入错误，请输入有效选项！${NC}"; sleep 1 ;;
        esac
    done
}

# 检查数据库
if [ ! -f "$DB_PATH" ]; then
    echo "警告: 监控数据库尚未初始化。请先运行选项 1。"
fi

main_menu
