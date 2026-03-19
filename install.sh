#!/bin/bash

# NanoMonitor 一键安装脚本
# 用途：下载预构建包，初始化配置，启动服务，并显示登录信息

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
INSTALL_DIR="/opt/nanomon"
DATA_DIR="/var/lib/nanomon"
SERVICE_NAME="nanomon"
VERSION="latest"
DOWNLOAD_URL="https://github.com/your-repo/nanomon/releases/${VERSION}/nanomon-linux-x64.tar.gz" 
# 注意：实际使用时，这里需要指向真实的预构建包地址。
# 为了演示，本脚本将模拟“下载预构建包”的过程（即从当前源码构建一个模拟包或直接使用源码运行但屏蔽npm步骤）
# *真实场景*：你应该在 CI/CD 中构建好 tar.gz 包，上传到 Release，这里直接 wget/curl 下载。

# 为了在当前演示环境中可行，我们将采用“混合模式”：
# 1. 如果检测到是真实服务器环境且有预构建包，直接下载解压。
# 2. 如果是开发/测试环境（如当前），则复制当前代码作为“预构建包”模拟，但跳过用户的 npm 步骤。
# *重要*：以下逻辑假设你已经通过 CI 构建了包含 node_modules 的完整包。

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}   NanoMonitor 一键安装脚本 (v1.7.4)   ${NC}"
echo -e "${BLUE}=========================================${NC}"

# 检查是否以 root 运行
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}错误：请使用 sudo 或 root 用户运行此脚本${NC}"
  exit 1
fi

# 1. 检查并安装基础依赖 (git, curl, wget, 以及 puppeteer 需要的系统库)
echo -e "${YELLOW}[1/5] 检查系统依赖...${NC}"
if command -v apt-get &> /dev/null; then
    # Debian/Ubuntu
    apt-get update -qq
    apt-get install -y -qq curl wget git ca-certificates \
        libgbm1 libasound2 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
        libdbus-1-3 libdrm2 libgtk-3-0 libnspr4 libnss3 libxkbcommon0 \
        libxrandr2 xdg-utils > /dev/null 2>&1 || true
elif command -v yum &> /dev/null; then
    # CentOS/RHEL
    yum install -y -q curl wget git ca-certificates \
        alsa-lib atk cups-libs dbus gtk3 libdrm libXcomposite libXdamage \
        libXext libXi libXtst pango nss xorg-x11-fonts-Type1 \
        xorg-x11-fonts-misc libXrender > /dev/null 2>&1 || true
fi

# 2. 创建目录
echo -e "${YELLOW}[2/5] 创建安装目录...${NC}"
mkdir -p "$INSTALL_DIR"
mkdir -p "$DATA_DIR"

# 3. 下载/部署程序
# *核心简化点*：这里不再执行 npm install。
# 假设我们有一个预构建的包，或者我们直接复用当前仓库作为“已构建”状态（仅限演示）
# 在真实发布中，这里应该是: curl -L $DOWNLOAD_URL | tar xz -C $INSTALL_DIR

echo -e "${YELLOW}[3/5] 部署程序 (跳过编译，使用预构建模块)...${NC}"

# 【模拟预构建包下载】
# 在实际产品中，请取消下面这行的注释，并替换为真实的 release 包下载地址
# curl -L "$DOWNLOAD_URL" | tar xz -C "$INSTALL_DIR"

# 【演示用逻辑】：将当前代码复制过去，并假装它是预构建好的
# 真实场景中，你的 CI 应该把 node_modules 打包进去，用户不需要运行 npm
cp -r /workspace/* "$INSTALL_DIR/"
cd "$INSTALL_DIR"

# 确保权限正确
chown -R root:root "$INSTALL_DIR"
chmod +x "$INSTALL_DIR/start.sh"
chmod +x "$INSTALL_DIR/menu.sh"

# 4. 初始化配置
echo -e "${YELLOW}[4/5] 初始化配置...${NC}"

# 生成随机账号密码
ADMIN_USER="admin"
ADMIN_PASS=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 10)
ACCESS_PATH=$(openssl rand -hex 4)

# 写入配置文件 (简化配置，只存关键信息)
cat > "$DATA_DIR/config.json" <<EOF
{
  "port": 3000,
  "adminUser": "$ADMIN_USER",
  "adminPass": "$ADMIN_PASS",
  "accessPath": "$ACCESS_PATH",
  "dataDir": "$DATA_DIR"
}
EOF

# 如果数据库不存在，初始化它 (调用一个简单的初始化命令，或者直接由主程序处理)
# 这里我们假设主程序启动时会自动迁移数据库，或者我们可以预先生成一个空的
touch "$DATA_DIR/nanomon.db"

# 5. 注册系统服务
echo -e "${YELLOW}[5/5] 注册系统服务并启动...${NC}"

cat > /etc/systemd/system/$SERVICE_NAME.service <<EOF
[Unit]
Description=NanoMonitor Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/start.sh
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=DATA_DIR=$DATA_DIR

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable $SERVICE_NAME
systemctl start $SERVICE_NAME

# 等待服务启动
sleep 2

# 获取本机 IP
IP_ADDR=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')
PORT=3000

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}   🎉 安装成功！                      ${NC}"
echo -e "${GREEN}=========================================${NC}"
echo -e "${BLUE} 访问地址:${NC} http://${IP_ADDR}:${PORT}/${ACCESS_PATH}"
echo -e "${BLUE} 管理员账号:${NC} ${ADMIN_USER}"
echo -e "${BLUE} 管理员密码:${NC} ${ADMIN_PASS}"
echo -e "${YELLOW}⚠️  请妥善保存上述账号密码！${NC}"
echo -e "${GREEN}=========================================${NC}"
echo -e "提示：运行 ${BLUE}nanomon${NC} 命令可打开管理菜单（升级、重启、查看日志）"

# 创建全局命令快捷方式
ln -sf "$INSTALL_DIR/menu.sh" /usr/local/bin/nanomon

echo -e "\n${GREEN}现在您可以直接在浏览器中访问上述地址了。${NC}"
