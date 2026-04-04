# Custom Anthropic Provider 配置指南

## 概述

这个 extension 提供了对 Anthropic API 的访问，支持：
- **安全密钥存储** - 使用 GNOME Keyring (secret-tool) 加密存储 API Key
- **OAuth 支持** - 通过 `/login custom-anthropic` 进行 OAuth 认证
- **自定义模型** - Claude Opus 4.5 和 Claude Sonnet 4.5

## 安装

### 方式 1：运行 install.sh（推荐）

```bash
cd ~/dotfiles
./install.sh
```

安装脚本会自动：
1. 创建软链接到 extension
2. 安装 npm 依赖 (`@anthropic-ai/sdk`)
3. 检查是否已配置 API Key

### 方式 2：手动安装

```bash
# 安装 npm 依赖
cd ~/.config/pi/agent/extensions/custom-anthropic
npm install

# 重启 pi
```

## 配置 API Key

### 使用 secret-tool（推荐）

```bash
# 交互式输入 API Key（不会显示在终端）
secret-tool store --label='Anthropic API Key' service 'anthropic' field 'api_key'

# 验证已存储
secret-tool lookup service 'anthropic' field 'api_key'

# 查看密钥前缀（验证）
secret-tool lookup service 'anthropic' field 'api_key' | head -c 15
```

### 使用环境变量（备选）

在 `~/.bashrc` 中添加：

```bash
export CUSTOM_ANTHROPIC_API_KEY="sk-ant-xxx..."
```

> ⚠️ 注意：环境变量不如 secret-tool 安全，所有子进程都可访问。

## 使用方法

### 启动 pi

```bash
pi
```

extension 会自动加载（在 settings.json 中已配置）。

### 选择模型

在 pi 中使用 `/model` 命令：

```
/model claude-sonnet-4-5
# 或
/model claude-opus-4-5
```

### 使用 OAuth（可选）

```
/login custom-anthropic
```

按照提示完成 OAuth 流程。

## 可用模型

| 模型 ID | 名称 | 输入价格 | 输出价格 | 上下文窗口 |
|--------|------|---------|---------|-----------|
| `claude-sonnet-4-5` | Claude Sonnet 4.5 | $3/1M | $15/1M | 200K |
| `claude-opus-4-5` | Claude Opus 4.5 | $5/1M | $25/1M | 200K |

## 故障排除

### 无法连接到 API

```bash
# 检查 API Key 是否正确配置
secret-tool lookup service 'anthropic' field 'api_key'

# 如果没有输出，重新存储密钥
secret-tool store --label='Anthropic API Key' service 'anthropic' field 'api_key'
```

### Extension 未加载

```bash
# 检查 extension 是否存在
ls -la ~/.config/pi/agent/extensions/custom-anthropic/

# 检查 npm 依赖是否安装
ls ~/.config/pi/agent/extensions/custom-anthropic/node_modules/@anthropic-ai/sdk

# 重新安装依赖
cd ~/.config/pi/agent/extensions/custom-anthropic && npm install
```

### 使用错误的模型

```bash
# 查看当前模型
/model

# 切换到正确的模型
/model claude-sonnet-4-5
```

## 文件结构

```
~/.config/pi/agent/
├── settings.json                  -> ../../dotfiles/tools/pi/agent/settings.json
├── extensions/
│   └── custom-anthropic/
│       ├── index.ts               -> ../../../../dotfiles/tools/pi/agent/extensions/custom-anthropic/index.ts
│       ├── package.json           -> ../../../../dotfiles/tools/pi/agent/extensions/custom-anthropic/package.json
│       ├── package-lock.json      -> ...
│       └── node_modules/          (本地安装，不同步)
```

## 安全提示

- ✅ **使用 secret-tool** - 密钥加密存储在 GNOME Keyring
- ✅ **不提交密钥到 git** - `.gitignore` 已排除敏感文件
- ❌ **避免明文环境变量** - 所有子进程都可访问 `/proc/[pid]/environ`

## 相关文档

- [密钥管理指南](../../../env/environment.d/SECRETS.md)
- [pi-permission-system 配置](./PERMISSIONS.md)
