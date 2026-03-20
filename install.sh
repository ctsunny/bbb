#!/bin/bash

# NanoMonitor 一键安装脚本 (v1.7.9)
# 极简设计：一行命令安装，自动显示登录信息
# 管理命令：nanomon

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 配置变量
INSTALL_DIR="/opt/nanomon"
DATA_DIR="/var/lib/nanomon"
SERVICE_NAME="nanomon"
REPO_URL="https://github.com/ctsunny/bbb.git"
BRANCH="main"

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}   NanoMonitor 一键安装脚本 (v1.7.9)   ${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# 检查是否以 root 运行
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}❌ 错误：请使用 sudo 或 root 用户运行此脚本${NC}"
  echo -e "${YELLOW}示例：curl -fsSL https://raw.githubusercontent.com/ctsunny/bbb/main/install.sh | sudo bash${NC}"
  exit 1
fi

# 1. 安装系统依赖
echo -e "${YELLOW}[1/5] 安装系统依赖...${NC}"
if command -v apt-get &> /dev/null; then
    apt-get update -qq >/dev/null 2>&1
    apt-get install -y -qq curl wget git ca-certificates unzip \
        build-essential python3 \
        chromium chromium-browser \
        libgbm1 libasound2 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
        libdbus-1-3 libdrm2 libgtk-3-0 libnspr4 libnss3 libxkbcommon0 \
        libxrandr2 xdg-utils fonts-liberation libappindicator3-1 \
        lsb-release >/dev/null 2>&1 || true
    echo -e "  ✓ Debian/Ubuntu 依赖安装完成"
elif command -v yum &> /dev/null; then
    yum install -y -q curl wget git ca-certificates unzip \
        gcc gcc-c++ make python3 \
        chromium \
        alsa-lib atk cups-libs dbus gtk3 libdrm libXcomposite libXdamage \
        libXext libXi libXtst pango nss xorg-x11-fonts-Type1 \
        xorg-x11-fonts-misc libXrender libAppIndicator libnss3 >/dev/null 2>&1 || true
    echo -e "  ✓ CentOS/RHEL 依赖安装完成"
else
    echo -e "${RED}❌ 不支持的系统，请手动安装依赖${NC}"
    exit 1
fi

# 2. 安装 Node.js 20.x（如未安装或版本过低）
echo -e "${YELLOW}[2/5] 检查 Node.js 环境...${NC}"
NODE_OK=false
if command -v node &> /dev/null; then
    NODE_VER=$(node -e "process.stdout.write(process.version)" 2>/dev/null || echo "v0")
    NODE_MAJOR=$(echo "$NODE_VER" | tr -d 'v' | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ] 2>/dev/null; then
        echo -e "  ✓ Node.js ${NODE_VER} 已满足要求"
        NODE_OK=true
    fi
fi
if [ "$NODE_OK" = false ]; then
    echo -e "  ${CYAN}安装 Node.js 20.x...${NC}"
    NODE_INSTALLED=false

    # 检测系统架构
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64)  NODE_ARCH="x64" ;;
        aarch64) NODE_ARCH="arm64" ;;
        armv7l)  NODE_ARCH="armv7l" ;;
        *)       NODE_ARCH="x64" ;;
    esac
    NODE_VERSION="20.19.0"

    if command -v apt-get &> /dev/null; then
        # 方法1：尝试 NodeSource（设置超时避免无限等待）
        echo -e "  ${CYAN}尝试从 NodeSource 安装...${NC}"
        if curl -fsSL --connect-timeout 15 --max-time 60 https://deb.nodesource.com/setup_20.x 2>/dev/null | bash - >/dev/null 2>&1; then
            if apt-get install -y -qq nodejs >/dev/null 2>&1 && command -v node &>/dev/null; then
                NODE_INSTALLED=true
            fi
        fi

        # 方法2：直接下载 Node.js 官方二进制包
        if [ "$NODE_INSTALLED" = false ]; then
            echo -e "  ${CYAN}NodeSource 不可用，直接下载 Node.js ${NODE_VERSION} 二进制包...${NC}"
            NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
            if wget -q --timeout=60 --tries=2 -O /tmp/node.tar.xz "$NODE_URL" 2>/dev/null \
               && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 >/dev/null 2>&1 \
               && command -v node &>/dev/null; then
                NODE_INSTALLED=true
            fi
            rm -f /tmp/node.tar.xz
        fi

        # 方法3：使用华为云镜像（适合国内/HK 用户）
        if [ "$NODE_INSTALLED" = false ]; then
            echo -e "  ${CYAN}尝试华为云镜像...${NC}"
            HW_URL="https://mirrors.huaweicloud.com/nodejs/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
            if wget -q --timeout=60 --tries=2 -O /tmp/node.tar.xz "$HW_URL" 2>/dev/null \
               && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 >/dev/null 2>&1 \
               && command -v node &>/dev/null; then
                NODE_INSTALLED=true
            fi
            rm -f /tmp/node.tar.xz
        fi

    elif command -v yum &> /dev/null; then
        # 方法1：尝试 NodeSource（设置超时避免无限等待）
        echo -e "  ${CYAN}尝试从 NodeSource 安装...${NC}"
        if curl -fsSL --connect-timeout 15 --max-time 60 https://rpm.nodesource.com/setup_20.x 2>/dev/null | bash - >/dev/null 2>&1; then
            if yum install -y -q nodejs >/dev/null 2>&1 && command -v node &>/dev/null; then
                NODE_INSTALLED=true
            fi
        fi

        # 方法2：直接下载 Node.js 官方二进制包
        if [ "$NODE_INSTALLED" = false ]; then
            echo -e "  ${CYAN}NodeSource 不可用，直接下载 Node.js ${NODE_VERSION} 二进制包...${NC}"
            NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
            if wget -q --timeout=60 --tries=2 -O /tmp/node.tar.xz "$NODE_URL" 2>/dev/null \
               && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 >/dev/null 2>&1 \
               && command -v node &>/dev/null; then
                NODE_INSTALLED=true
            fi
            rm -f /tmp/node.tar.xz
        fi

        # 方法3：使用华为云镜像（适合国内/HK 用户）
        if [ "$NODE_INSTALLED" = false ]; then
            echo -e "  ${CYAN}尝试华为云镜像...${NC}"
            HW_URL="https://mirrors.huaweicloud.com/nodejs/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
            if wget -q --timeout=60 --tries=2 -O /tmp/node.tar.xz "$HW_URL" 2>/dev/null \
               && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 >/dev/null 2>&1 \
               && command -v node &>/dev/null; then
                NODE_INSTALLED=true
            fi
            rm -f /tmp/node.tar.xz
        fi
    fi

    if [ "$NODE_INSTALLED" = false ]; then
        echo -e "${RED}❌ Node.js 安装失败，请手动安装 Node.js 18+ 后重试${NC}"
        exit 1
    fi
    echo -e "  ✓ Node.js $(node -v 2>/dev/null) 安装完成"
fi

# 3. 创建目录
echo -e "${YELLOW}[3/5] 创建安装目录...${NC}"
mkdir -p "$INSTALL_DIR"
mkdir -p "$DATA_DIR"

# 4. 克隆代码（预构建模式：代码已包含所有依赖）
echo -e "${YELLOW}[4/5] 下载程序文件...${NC}"

# 清理旧版本（如果是升级）
if [ -d "$INSTALL_DIR/.git" ]; then
    echo -e "  ${CYAN}检测到旧版本，正在备份配置...${NC}"
    cp -f "$INSTALL_DIR/.env" "$DATA_DIR/.env.backup" 2>/dev/null || true
    cp -f "$INSTALL_DIR/data/nanomon.db" "$DATA_DIR/nanomon.db.backup" 2>/dev/null || true
fi

# 克隆最新代码
rm -rf "$INSTALL_DIR" 2>/dev/null || true
git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR" >/dev/null 2>&1

if [ ! -d "$INSTALL_DIR/server" ]; then
    echo -e "${RED}❌ 下载失败，请检查网络连接${NC}"
    exit 1
fi

cd "$INSTALL_DIR"

# 恢复备份的配置
if [ -f "$DATA_DIR/.env.backup" ]; then
    cp -f "$DATA_DIR/.env.backup" "$INSTALL_DIR/.env" 2>/dev/null || true
fi

# 设置权限
chmod +x "$INSTALL_DIR/start.sh" 2>/dev/null || true
chmod +x "$INSTALL_DIR/menu.sh" 2>/dev/null || true
chown -R root:root "$INSTALL_DIR"

echo -e "  ✓ 程序文件部署完成"

# 安装 Node.js 依赖（跳过 puppeteer 自动下载 Chromium，改用系统 Chromium）
echo -e "  ${CYAN}安装 Node.js 依赖...${NC}"
cd "$INSTALL_DIR/server"
# 设置 npm 镜像（中国/HK 环境加速）并跳过 puppeteer 内置 Chromium 下载
export PUPPETEER_SKIP_DOWNLOAD=true
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
NPM_INSTALL_LOG=$(npm install --production --no-audit --no-fund 2>&1)
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ npm install 失败，错误信息如下：${NC}"
    echo "$NPM_INSTALL_LOG" | tail -20
    echo -e "${YELLOW}提示：请检查网络连接和 Node.js 环境（需要 18+）${NC}"
    exit 1
fi
cd "$INSTALL_DIR"
echo -e "  ✓ Node.js 依赖安装完成"

# 检测系统 Chromium 路径（供 puppeteer 使用）
CHROME_BIN=""
for p in /usr/bin/chromium /usr/bin/chromium-browser /usr/bin/google-chrome /usr/bin/google-chrome-stable; do
    if [ -x "$p" ]; then
        CHROME_BIN="$p"
        break
    fi
done
if [ -n "$CHROME_BIN" ]; then
    echo -e "  ✓ 检测到系统 Chromium：$CHROME_BIN"
else
    echo -e "  ${YELLOW}⚠ 未检测到系统 Chromium，尝试下载 puppeteer 内置 Chromium...${NC}"
    cd "$INSTALL_DIR/server"
    if npx puppeteer browsers install chrome >/dev/null 2>&1; then
        echo -e "  ✓ puppeteer 内置 Chromium 下载完成"
    else
        echo -e "  ${YELLOW}⚠ Chromium 下载失败，监控功能可能受限。可稍后手动运行：cd /opt/nanomon/server && npx puppeteer browsers install chrome${NC}"
    fi
    cd "$INSTALL_DIR"
fi

# 5. 初始化配置并启动服务
echo -e "${YELLOW}[5/5] 初始化配置并启动服务...${NC}"

# 生成随机账号密码（仅首次安装时）
if [ ! -f "$DATA_DIR/config.json" ]; then
    ADMIN_USER="admin"
    ADMIN_PASS=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 12)
    ACCESS_PATH=$(openssl rand -hex 4)
    
    cat > "$DATA_DIR/config.json" <<EOF
{
  "port": 3000,
  "adminUser": "$ADMIN_USER",
  "adminPass": "$ADMIN_PASS",
  "accessPath": "$ACCESS_PATH",
  "dataDir": "$DATA_DIR"
}
EOF
    echo -e "  ✓ 生成随机账号密码"
else
    # 读取已有配置
    ADMIN_USER=$(grep -o '"adminUser": "[^"]*"' "$DATA_DIR/config.json" | cut -d'"' -f4)
    ADMIN_PASS=$(grep -o '"adminPass": "[^"]*"' "$DATA_DIR/config.json" | cut -d'"' -f4)
    ACCESS_PATH=$(grep -o '"accessPath": "[^"]*"' "$DATA_DIR/config.json" | cut -d'"' -f4)
    echo -e "  ✓ 使用已有配置"
fi

# 确保数据库目录存在
mkdir -p "$INSTALL_DIR/data"
cp -f "$DATA_DIR/nanomon.db.backup" "$INSTALL_DIR/data/nanomon.db" 2>/dev/null || touch "$INSTALL_DIR/data/nanomon.db"

# 注册 systemd 服务
CHROME_ENV_LINE=""
if [ -n "$CHROME_BIN" ]; then
    CHROME_ENV_LINE="Environment=PUPPETEER_EXECUTABLE_PATH=$CHROME_BIN"
fi

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
Environment=PUPPETEER_SKIP_DOWNLOAD=true
${CHROME_ENV_LINE}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload >/dev/null 2>&1
systemctl enable $SERVICE_NAME >/dev/null 2>&1
systemctl start $SERVICE_NAME >/dev/null 2>&1

# 等待服务启动
sleep 3

# 获取本机 IP
IP_ADDR=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
PORT=3000

echo -e ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}   🎉 安装成功！                      ${NC}"
echo -e "${GREEN}=========================================${NC}"
echo -e "${BLUE}📍 访问地址:${NC} http://${IP_ADDR}:${PORT}/${ACCESS_PATH}"
echo -e "${BLUE}👤 管理员账号:${NC} ${ADMIN_USER}"
echo -e "${BLUE}🔑 管理员密码:${NC} ${ADMIN_PASS}"
echo -e ""
echo -e "${YELLOW}⚠️  请妥善保存上述账号密码！${NC}"
echo -e "${GREEN}=========================================${NC}"
echo -e ""
echo -e "💡 管理命令：${BLUE}nanomon${NC}"
echo -e "   - 选择 [1] 一键升级"
echo -e "   - 选择 [2] 重启服务"
echo -e "   - 选择 [3] 查看日志"
echo -e "   - 选择 [4] 重置密码"
echo -e "   - 选择 [5] 完全卸载"
echo -e ""
echo -e "${CYAN}现在您可以在浏览器中访问上述地址了${NC}"

# 创建全局命令快捷方式
ln -sf "$INSTALL_DIR/menu.sh" /usr/local/bin/nanomon
