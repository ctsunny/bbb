#!/bin/bash

# NanoMonitor / BWPanel Management Script

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SERVER_DIR="$(cd "$(dirname "$0")/server" && pwd)"
DB_PATH="$SERVER_DIR/monitor.db"

# --- Functions ---
get_setting() {
    sqlite3 "$DB_PATH" "SELECT value FROM settings WHERE key = '$1';"
}

update_setting() {
    sqlite3 "$DB_PATH" "REPLACE INTO settings (key, value) VALUES ('$1', '$2');"
}

show_config() {
    clear
    echo -e "${BLUE}=== Current Panel Configuration ===${NC}"
    
    local USER=$(get_setting "admin_user")
    local PASS=$(get_setting "admin_pass")
    local PATH_SUB=$(get_setting "access_path")
    local TOKEN=$(get_setting "reg_token")
    local BARK=$(get_setting "bark_key")
    local IP=$(curl -s ifconfig.me)

    echo -e "Panel URL    : ${YELLOW}http://$IP:5173/console-$PATH_SUB${NC}"
    echo -e "Username     : ${GREEN}$USER${NC}"
    echo -e "Password     : ${RED}$PASS${NC}"
    echo -e "Access Token : ${BLUE}$TOKEN${NC}"
    echo -e "Bark URL     : ${BARK:-'Not Configured'}"
    echo -e "Common Cmds : systemctl status monitor | journalctl -u monitor -f"
    echo -e "Management Script: monitor-menu"
    echo "==================================="
    read -p "Press any key to return to menu..." -n1 -s
}

reset_pass() {
    local NEW_PASS=$(LC_ALL=C tr -dc 'a-zA-Z0-9' < /dev/urandom | fold -w 8 | head -n 1)
    update_setting "admin_pass" "$NEW_PASS"
    echo -e "${GREEN}Password reset successfully: $NEW_PASS${NC}"
    sleep 2
}

reset_token() {
    local NEW_TOKEN=$(openssl rand -hex 16)
    update_setting "reg_token" "$NEW_TOKEN"
    echo -e "${GREEN}Access Token reset successfully: $NEW_TOKEN${NC}"
    sleep 2
}

reset_path() {
    local NEW_PATH=$(openssl rand -hex 8)
    update_setting "access_path" "$NEW_PATH"
    echo -e "${GREEN}Access Path reset successfully: console-$NEW_PATH${NC}"
    sleep 2
}

config_bark() {
    read -p "Enter Bark Key: " BARK_KEY
    if [ ! -z "$BARK_KEY" ]; then
        update_setting "bark_key" "$BARK_KEY"
        echo -e "${GREEN}Bark Key updated!${NC}"
    fi
    sleep 2
}

# --- Main Menu ---
main_menu() {
    while true; do
        clear
        echo "======== NanoMonitor Management Menu ========"
        echo " 1. Install / Reinstall Server"
        echo " 2. Update System (Pull latest)"
        echo " 3. View Current Config and Panel URL"
        echo " 4. Reset Admin Password"
        echo " 5. Reset Panel Access Path"
        echo " 6. Reset Client Access Token"
        echo " 7. Configure Bark Key"
        echo " 8. View Service Logs"
        echo " 9. Restart Service"
        echo " 10. Uninstall Monitor System"
        echo " 11. Generate Installation Shortcut"
        echo " 0. Exit"
        echo "============================================="
        read -p "Please select an option [0-11]: " opt
        
        case $opt in
            1) 
                echo -e "${YELLOW}Installing/Reinstalling dependencies (Server & Client)...${NC}"
                (cd server && npm install)
                (cd client && npm install)
                echo -e "${GREEN}Dependencies installed! Starting initial run...${NC}"
                node server/index.js &
                sleep 5
                ;;
            2) 
                echo -e "${YELLOW}Updating from GitHub...${NC}"
                git pull
                (cd server && npm install)
                (cd client && npm install)
                echo -e "${GREEN}System Updated. Restarting...${NC}"
                systemctl restart monitor 2>/dev/null || pm2 restart monitor 2>/dev/null || echo "Please manual restart."
                sleep 2
                ;;
            3) show_config ;;
            4) reset_pass ;;
            5) reset_path ;;
            6) reset_token ;;
            7) config_bark ;;
            8) 
                echo -e "${BLUE}Viewing real-time logs (Ctrl+C to stop)...${NC}"
                journalctl -u monitor -f 2>/dev/null || tail -f server/logs.log 2>/dev/null || echo "Logs not found."
                sleep 1 
                ;;
            9) 
                echo -e "${YELLOW}Restarting Monitor Service...${NC}"
                systemctl restart monitor 2>/dev/null || pm2 restart monitor 2>/dev/null || echo "Restarted failed. Try manually."
                sleep 2
                ;;
            10) 
                read -p "Are you SURE you want to uninstall? Content will be lost. [y/N]: " confirm
                if [[ "$confirm" == "y" || "$confirm" == "Y" ]]; then
                    echo -e "${RED}Uninstalling...${NC}"
                    rm "$DB_PATH"
                    echo -e "${YELLOW}Database purged. Manually delete the 'bbb' directory to finish.${NC}"
                    exit 0
                fi
                ;;
            11) 
                echo "alias monitor='./menu.sh'" >> ~/.bashrc
                echo -e "${GREEN}Created 'monitor' shortcut! Restart your shell to use it.${NC}"
                sleep 2
                ;;
            0) exit 0 ;;
            *) echo -e "${RED}Invalid Option!${NC}"; sleep 1 ;;
        esac
    done
}

# Ensure DB exists for initial run
if [ ! -f "$DB_PATH" ]; then
    echo "Monitor database not found. Please run individual setup first."
fi

main_menu
