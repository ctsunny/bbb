# ⚡ NanoMonitor (BWPanel Edition)

[English](#english) | [中文](#chinese)

---

<a name="chinese"></a>

## 🇨🇳 中文说明 - 企业级安全重构版

本项目已参考 **BWPanel** 设计理念进行了深度重构，旨在提供一个“开箱即用”且具备**安全性**的专业监控系统。

### ✨ 重构亮点 (新版特性)
1.  **交互式管理脚本 (`menu.sh`)**：仿照 Linux 经典工具，提供图形化命令行菜单。只需运行 `./menu.sh` 即可完成：
    *   查看面板随机地址、用户名和加密密码。
    *   重置管理员凭据与访问路径。
    *   管理服务状态与实时日志。
2.  **动态访问路径 (Security Path)**：面板不再是固定的 `/` 根目录。系统初始化时会生成一组随机路径（如 `console-8a2f...`），大幅降低了被暴力破解的风险。
3.  **身份验证令牌 (Registration Token)**：前端与后端交互现在受令牌保护。只有通过登录校验的用户才能发起监控请求。
4.  **控制台登录界面**：新增了极简黑客风格的登录页。

### 🚀 快速管理
```bash
# 给予执行权限
chmod +x menu.sh

# 启动管理菜单
./menu.sh
```

---

<a name="english"></a>

## 🇺🇸 English Description - BWPanel Security Refactor

This system has been refactored based on the **BWPanel** design concept to provide a professional, **security-first** monitoring environment.

### ✨ Refactor Highlights
1.  **Interactive Script (`menu.sh`)**: A classic Linux-style TUI to manage your system. Run `./menu.sh` to:
    *   Retrieve random Panel URLs, usernames, and passwords.
    *   Reset credentials and access paths.
    *   Monitor system logs and service health.
2.  **Dynamic Access Paths**: Protects your dashboard with a randomized subpath (e.g., `/console-8a2f...`) generated on first boot.
3.  **Encrypted Token Auth**: All frontend/backend communication is now signed with internal registration tokens.
4.  **Hacker-style Login**: A new security-focused console entry point.

### 🚀 Usage
```bash
# Set permissions
chmod +x menu.sh

# Run the management TUI
./menu.sh
```
