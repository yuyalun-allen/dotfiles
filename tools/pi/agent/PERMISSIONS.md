# pi-permission-system 配置指南

## 概述

pi-permission-system 为 pi coding agent 提供权限控制，支持：
- 工具调用权限（read, write, bash, edit 等）
- Bash 命令白名单/黑名单
- MCP 工具权限
- Skill 加载权限
- 每 Agent 策略覆盖

## 安装

### 方式 1：通过 settings.json（推荐）

`settings.json` 中已配置：
```json
{
  "packages": ["npm:pi-permission-system"]
}
```

运行 `pi install` 或重启 pi 时会自动安装。

### 方式 2：手动安装

```bash
pi install npm:pi-permission-system
```

## 配置文件

### 全局策略：`~/.config/pi/agent/pi-permissions.jsonc`

配置文件已创建，包含以下权限策略：

```jsonc
{
  "defaultPolicy": {
    "tools": "ask",    // 默认询问
    "bash": "ask",
    "mcp": "ask",
    "skills": "ask",
    "special": "ask"
  },
  "tools": {
    "read": "allow",   // 允许读取文件
    "ls": "allow",     // 允许列出目录
    "grep": "allow",   // 允许搜索
    "find": "allow",   // 允许查找
    "write": "ask",    // 写入文件前询问
    "edit": "ask",     // 编辑文件前询问
    "bash": "ask"      // 执行 bash 命令前询问
  },
  "bash": {
    "git status": "allow",  // 允许 git status
    "git diff": "allow",
    "ls *": "allow",
    "cat *": "allow",
    "sudo *": "deny",       // 禁止 sudo
    "rm *": "ask",          // 删除前询问
    "*": "ask"              // 其他命令询问
  }
}
```

### 权限状态

| 状态 | 行为 |
|------|------|
| `allow` | 允许，静默通过 |
| `deny` | 拒绝，阻止操作 |
| `ask` | 询问，弹出确认对话框 |

### 扩展配置：`~/.config/pi/agent/extensions/pi-permission-system/config.json`

```json
{
  "debugLog": false,           // 调试日志
  "permissionReviewLog": true  // 权限审查日志（推荐开启）
}
```

## 使用示例

### 允许常见 git 命令

```jsonc
{
  "bash": {
    "git status": "allow",
    "git diff": "allow",
    "git log": "allow",
    "git checkout *": "ask",
    "git *": "ask"
  }
}
```

### 禁止危险操作

```jsonc
{
  "bash": {
    "sudo *": "deny",
    "rm -rf *": "deny",
    "curl * | *sh": "deny"
  },
  "tools": {
    "write": "ask",
    "bash": "ask"
  }
}
```

### 每 Agent 策略覆盖

在 `~/.config/pi/agent/agents/reviewer.md` 中添加：

```markdown
---
permission:
  tools:
    write: deny
    edit: deny
  bash:
    "*": ask
---
```

## 日志位置

权限审查日志保存在：
```
~/.config/pi/agent/extensions/pi-permission-system/logs/pi-permission-system-permission-review.jsonl
```

## 验证配置

1. 启动 pi
2. 执行一个需要权限的操作（如 `rm` 命令）
3. 应该会看到确认对话框

## 故障排除

### 配置不生效

1. 检查配置文件位置：`~/.config/pi/agent/pi-permissions.jsonc`
2. 检查 JSON 格式是否正确（无语法错误）
3. 重启 pi 会话

### 扩展未加载

1. 确认已安装：`pi list`
2. 检查扩展目录：`ls ~/.config/pi/agent/extensions/`
3. 手动安装：`pi install npm:pi-permission-system`

## 相关文件

- 全局策略：`~/.config/pi/agent/pi-permissions.jsonc`
- 扩展配置：`~/.config/pi/agent/extensions/pi-permission-system/config.json`
- Schema：`/home/allen/.config/nvm/versions/node/v22.19.0/lib/node_modules/pi-permission-system/schemas/permissions.schema.json`
