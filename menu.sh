#!/bin/bash

# NanoMonitor 管理菜单 (BWPanel 版) - 中文
# 依赖: Node.js + better-sqlite3 (无需 sqlite3 命令行工具)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# 脚本所在目录（兼容软链接）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"
DB_PATH="$SERVER_DIR/monitor.db"

# --- 通过 Node.js 读写数据库 (不依赖 sqlite3 命令) ---
get_setting() {
    node "$SERVER_DIR/get_setting.js" "$1" 2>/dev/null
}

update_setting() {
    node "$SERVER_DIR/set_setting.js" "$1" "$2" 2>/dev/null
}

# --- 检查并自动安装依赖 ---
check_deps() {
    # 检查 Node.js，不存在则自动安装
    if ! command -v node &>/dev/null; then
        echo -e "${YELLOW}  ⚙  未检测到 Node.js，正在自动安装（需要 root 权限）...${NC}"
        
        # 检测包管理器
        if command -v apt-get &>/dev/null; then
            echo -e "${BLUE}  → 检测到 Debian/Ubuntu 系统，使用 apt 安装...${NC}"
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>&1 | tail -5
            apt-get install -y nodejs 2>&1 | tail -5
        elif command -v yum &>/dev/null; then
            echo -e "${BLUE}  → 检测到 CentOS/RHEL 系统，使用 yum 安装...${NC}"
            curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - 2>&1 | tail -5
            yum install -y nodejs 2>&1 | tail -5
        elif command -v dnf &>/dev/null; then
            echo -e "${BLUE}  → 检测到 Fedora 系统，使用 dnf 安装...${NC}"
            curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - 2>&1 | tail -5
            dnf install -y nodejs 2>&1 | tail -5
        else
            echo -e "${RED}  ✗ 无法自动识别包管理器，请手动安装 Node.js 20+：${NC}"
            echo -e "${YELLOW}    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs${NC}"
            exit 1
        fi

        # 安装后再次验证
        if ! command -v node &>/dev/null; then
            echo -e "${RED}  ✗ Node.js 安装失败，请手动安装后重试。${NC}"
            exit 1
        fi
        echo -e "${GREEN}  ✓ Node.js $(node -v) 安装完成！${NC}"
        sleep 2
    fi

    # 检查服务端依赖
    if [ ! -d "$SERVER_DIR/node_modules/better-sqlite3" ]; then
        echo -e "${YELLOW}  ⚙  正在安装服务端依赖 (npm install)...${NC}"
        (cd "$SERVER_DIR" && npm install --silent) && echo -e "${GREEN}  ✓ 服务端依赖安装完成${NC}"
    fi
}

# --- 查看配置信息 ---
show_config() {
    clear
    
    # 先确保数据库已初始化
    if [ ! -f "$DB_PATH" ]; then
        echo -e "${RED}数据库未初始化，请先运行《选项 1》安装环境并启动一次服务端！${NC}"
        read -p "按任意键返回..." -n1 -s
        return
    fi

    local USER=$(get_setting "admin_user")
    local PASS=$(get_setting "admin_pass")
    local PATH_SUB=$(get_setting "access_path")
    local TOKEN=$(get_setting "reg_token")
    local BARK=$(get_setting "bark_key")
    local IP
    IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

    echo ""
    echo -e "${BOLD}${BLUE}  面板地址    :${NC} ${YELLOW}http://$IP:5173/${NC}"
    echo -e "${BOLD}${BLUE}  用户名      :${NC} ${GREEN}$USER${NC}"
    echo -e "${BOLD}${BLUE}  登录密码    :${NC} ${RED}$PASS${NC}"
    echo -e "${BOLD}${BLUE}  注册 Token  :${NC} $TOKEN"
    echo -e "${BOLD}${BLUE}  Bark 推送   :${NC} ${BARK:-（未配置）}"
    echo -e "${BOLD}${BLUE}  常用命令    :${NC} systemctl status monitor | journalctl -u monitor -f"
    echo -e "${BOLD}${BLUE}  管理命令    :${NC} monitor-menu"
    echo ""
    echo -e "  ${YELLOW}=================================${NC}"
    read -p "  按任意键返回菜单..." -n1 -s
}

# --- 重置密码 ---
reset_pass() {
    local NEW_PASS
    NEW_PASS=$(LC_ALL=C tr -dc 'a-zA-Z0-9' < /dev/urandom | fold -w 10 | head -n 1)
    update_setting "admin_pass" "$NEW_PASS"
    echo -e "${GREEN}密码重置成功！新密码: ${BOLD}$NEW_PASS${NC}"
    sleep 3
}

# --- 重置访问路径 ---
reset_path() {
    local NEW_PATH
    NEW_PATH=$(od -A n -t x -N 8 /dev/urandom | tr -d ' \n')
    update_setting "access_path" "$NEW_PATH"
    echo -e "${GREEN}访问路径已重置: ${BOLD}console-$NEW_PATH${NC}"
    sleep 3
}

# --- 重置 Token ---
reset_token() {
    local NEW_TOKEN
    NEW_TOKEN=$(od -A n -t x -N 16 /dev/urandom | tr -d ' \n')
    update_setting "reg_token" "$NEW_TOKEN"
    echo -e "${GREEN}注册 Token 已重置！${NC}"
    sleep 3
}

# --- 配置 Bark ---
config_bark() {
    echo ""
    read -p "  请输入你的 Bark Key: " BARK_KEY
    if [ -n "$BARK_KEY" ]; then
        update_setting "bark_key" "$BARK_KEY"
        echo -e "${GREEN}  Bark 推送配置已保存！${NC}"
    else
        echo -e "${YELLOW}  输入为空，未做修改。${NC}"
    fi
    sleep 2
}

# --- 打印主菜单 ---
print_menu() {
    clear
    echo ""
    echo -e "  ${BOLD}${BLUE}======== NanoMonitor 管理菜单 ========${NC}"
    echo -e "  ${BOLD}   1.${NC}  安装 / 重新安装依赖（首次必做）"
    echo -e "  ${BOLD}   2.${NC}  升级系统（自动拉取最新代码）"
    echo -e "  ${BOLD}   3.${NC}  查看当前配置与面板地址"
    echo -e "  ${BOLD}   4.${NC}  重置管理员密码"
    echo -e "  ${BOLD}   5.${NC}  重置面板访问随机路径"
    echo -e "  ${BOLD}   6.${NC}  重置客户端注册 Token"
    echo -e "  ${BOLD}   7.${NC}  配置 Bark 推送通知"
    echo -e "  ${BOLD}   8.${NC}  查看实时服务日志"
    echo -e "  ${BOLD}   9.${NC}  重启监控服务"
    echo -e "  ${BOLD}  10.${NC}  完整卸载"
    echo -e "  ${BOLD}  11.${NC}  添加 'monitor' 全局快捷命令"
    echo -e "  ${BOLD}${BLUE}  ======================================${NC}"
    echo -e "  ${BOLD}   0.${NC}  退出"
    echo ""
}

# --- 主循环 ---
check_deps

while true; do
    print_menu
    read -p "  请选择操作 [0-11]: " opt
    echo ""
    
    case $opt in
        1)
            echo -e "${YELLOW}  ⚙  开始一键安装 NanoMonitor...${NC}"
            echo ""

            # 安装 C++ 编译工具
            echo -e "${BLUE}  [1/4] 安装系统编译工具...${NC}"
            if command -v apt-get &>/dev/null; then
                apt-get install -y python3 make g++ build-essential 2>&1 | tail -2
            elif command -v yum &>/dev/null; then
                yum install -y python3 make gcc-c++ 2>&1 | tail -2
            fi
            echo -e "${GREEN}  ✓ 编译工具就绪${NC}"

            # 安装服务端依赖
            echo -e "${BLUE}  [2/4] 编译安装服务端依赖...${NC}"
            cd "$SERVER_DIR"
            rm -rf node_modules package-lock.json
            npm install 2>&1 | tail -3
            echo -e "${GREEN}  ✓ 服务端依赖安装完成${NC}"

            # 安装客户端依赖
            echo -e "${BLUE}  [3/4] 安装客户端依赖...${NC}"
            cd "$SCRIPT_DIR/client"
            rm -rf node_modules package-lock.json
            npm install --legacy-peer-deps 2>&1 | tail -3
            echo -e "${GREEN}  ✓ 客户端依赖安装完成${NC}"

            # 启动服务
            echo -e "${BLUE}  [4/4] 初始化数据库并启动服务...${NC}"
            cd "$SCRIPT_DIR"

            # 杀掉旧进程
            pkill -f "node server/index.js" 2>/dev/null
            pkill -f "vite" 2>/dev/null
            sleep 1

            # 启动后端
            nohup node "$SERVER_DIR/index.js" > "$SERVER_DIR/server.log" 2>&1 &
            BACKEND_PID=$!
            sleep 4

            # 启动前端
            nohup npx --prefix "$SCRIPT_DIR/client" vite --host 0.0.0.0 > "$SCRIPT_DIR/client/client.log" 2>&1 &
            FRONTEND_PID=$!
            sleep 4

            echo -e "${GREEN}  ✓ 服务已全部启动！${NC}"
            echo ""

            # 自动显示登录信息
            SHOW_USER=$(get_setting "admin_user")
            SHOW_PASS=$(get_setting "admin_pass")
            SHOW_PATH=$(get_setting "access_path")
            SHOW_TOKEN=$(get_setting "reg_token")
            SHOW_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

            echo -e "  ${BOLD}${YELLOW}══════════ 安装完成！以下是你的登录信息 ══════════${NC}"
            echo ""
            echo -e "  ${BOLD}${BLUE}  面板地址  :${NC} ${YELLOW}http://$SHOW_IP:5173/${NC}"
            echo -e "  ${BOLD}${BLUE}  用户名    :${NC} ${GREEN}$SHOW_USER${NC}"
            echo -e "  ${BOLD}${BLUE}  登录密码  :${NC} ${RED}$SHOW_PASS${NC}"
            echo -e "  ${BOLD}${BLUE}  令牌      :${NC} $SHOW_TOKEN"
            echo ""
            echo -e "  ${YELLOW}  使用 './menu.sh' 可随时管理系统${NC}"
            echo -e "  ${BOLD}${YELLOW}══════════════════════════════════════════════════${NC}"
            echo ""
            read -p "  按任意键返回菜单..." -n1 -s
            ;;
        2)
            echo -e "${YELLOW}  正在从 GitHub 拉取最新版本...${NC}"
            git -C "$SCRIPT_DIR" pull
            (cd "$SERVER_DIR" && npm install)
            (cd "$SCRIPT_DIR/client" && npm install --legacy-peer-deps)
            echo -e "${GREEN}  升级完成！${NC}"
            systemctl restart monitor 2>/dev/null || pm2 restart monitor 2>/dev/null || echo -e "${YELLOW}  请手动重启服务。${NC}"
            sleep 3
            ;;
        3) show_config ;;
        4) reset_pass ;;
        5) reset_path ;;
        6) reset_token ;;
        7) config_bark ;;
        8)
            echo -e "${BLUE}  实时日志输出 (Ctrl+C 退出)...${NC}"
            journalctl -u monitor -f 2>/dev/null || \
            tail -f "$SERVER_DIR/monitor.log" 2>/dev/null || \
            echo -e "${RED}  未找到日志文件，请确认服务已安装为 systemd 服务。${NC}"
            ;;
        9)
            echo -e "${YELLOW}  正在重启监控服务...${NC}"
            systemctl restart monitor 2>/dev/null || \
            pm2 restart monitor 2>/dev/null || \
            echo -e "${RED}  重启失败，服务可能未安装，请手动执行: node server/index.js${NC}"
            sleep 2
            ;;
        10)
            echo -e "${RED}  警告：此操作将清除所有监控数据库！${NC}"
            read -p "  确认卸载？请输入 yes 确认: " confirm
            if [ "$confirm" = "yes" ]; then
                rm -f "$DB_PATH"
                echo -e "${GREEN}  数据库已清理。${NC}"
                echo -e "${YELLOW}  如需彻底移除，请手动删除整个项目目录。${NC}"
                exit 0
            else
                echo -e "${YELLOW}  操作已取消。${NC}"
            fi
            sleep 2
            ;;
        11)
            MENU_PATH="$SCRIPT_DIR/menu.sh"
            echo "alias monitor-menu='bash $MENU_PATH'" >> ~/.bashrc
            echo -e "${GREEN}  快捷命令 'monitor-menu' 已添加到 ~/.bashrc${NC}"
            echo -e "${YELLOW}  请执行: source ~/.bashrc 或重开终端后生效${NC}"
            sleep 3
            ;;
        0)
            echo -e "  ${GREEN}已退出。再见！${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}  无效选项，请重新输入。${NC}"
            sleep 1
            ;;
    esac
done
