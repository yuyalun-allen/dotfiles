# pi-agent 密钥管理指南

## 为什么使用 secret-tool？

- 🔒 **安全存储**: 密钥加密存储在 GNOME Keyring 中，不在磁盘中明文保存
- 🔓 **自动解锁**: 登录 GNOME 时自动解锁，无需每次输入密码
- 📝 **方便调用**: 简单的命令行接口，易于集成到脚本中

## 快速开始

### 1. 存储密钥

```bash
# 使用封装脚本
cd tools/pi/agent/

# 存储 Google Gemini OAuth refresh token
./pi-secrets.sh set --field refresh_token --provider google-gemini-cli --type oauth

# 存储其他字段
./pi-secrets.sh set --field access_token --provider google-gemini-cli
./pi-secrets.sh set --field projectId --provider google-gemini-cli
./pi-secrets.sh set --field api_key --provider anthropic
```

### 2. 查看已存储的密钥

```bash
./pi-secrets.sh list
```

### 3. 在 pi agent 中使用

#### 方式 A: 自动生成 auth.json

```bash
# 导出为 auth.json 格式
./pi-secrets.sh export > ~/.config/pi/agent/auth.json
```

#### 方式 B: 使用环境变量加载脚本

在你的 `.bashrc` 中添加:

```bash
# 加载 pi secrets 到环境变量
source ~/dotfiles/tools/pi/agent/load-pi-secrets.sh
```

然后在启动 pi 时，环境变量会自动设置。

### 4. 手动使用 secret-tool

```bash
# 查看原始命令
secret-tool search --all service "pi-agent"

# 获取单个值
secret-tool lookup service "pi-agent" provider "google-gemini-cli" field "refresh_token"
```

## 在 install.sh 中集成

安装脚本会自动：
1. 创建软链接到 `pi-secrets.sh` 和 `load-pi-secrets.sh`
2. 提示你设置密钥

## 迁移现有的 auth.json

如果你已有 `auth.json` 文件，可以将其中的密钥迁移到 GNOME Keyring:

```bash
# 从 auth.json 读取并存储到 keyring
jq -r '.["google-gemini-cli"].refresh' ~/.config/pi/agent/auth.json | \
  secret-tool store --label "pi-agent-gemini" \
    service "pi-agent" \
    provider "google-gemini-cli" \
    field "refresh_token"

# 删除明文 auth.json
rm ~/.config/pi/agent/auth.json
```

## 安全提示

- ✅ 密钥存储在加密的 GNOME Keyring 中
- ✅ 登录时自动解锁，无需额外密码
- ✅ 不在 git 中存储密钥
- ⚠️ 不要将 `auth.json` 提交到 git
- ⚠️ 定期轮换敏感的 OAuth 令牌和 API Key

## 故障排除

### 提示 "No such file or directory"

确保 GNOME Keyring 服务正在运行:

```bash
systemctl --user status gnome-keyring-daemon
```

### 无法解锁 Keyring

如果你设置了单独的 Keyring 密码，可能需要输入。可以在"密码和密钥"应用中设置自动解锁。

### 查看密钥ring 状态

```bash
seahorse  # GNOME 的图形化密钥管理工具
```
