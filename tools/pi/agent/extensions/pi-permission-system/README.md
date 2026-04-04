# pi-permission-system (本地手动管理版本)

## 版本信息
- **版本**: 0.4.1 (基于 npm 版本)
- **管理方式**: 手动管理（不由 npm 控制）
- **配置位置**: `config.json`
- **日志位置**: `logs/` 目录

## 已应用的修复

### 1. permission-manager.ts
使用 `$PI_CODING_AGENT_DIR` 环境变量读取配置文件，支持自定义配置目录。

### 2. wildcard-matcher.ts
修复模式匹配顺序，改为从前向后匹配，确保更具体的规则优先。

## 配置

编辑 `config.json` 修改设置：
```json
{
  "debugLog": false,           // 启用调试日志
  "permissionReviewLog": true, // 记录权限审查日志
  "yoloMode": false            // 自动批准所有询问（危险！）
}
```

## 更新方法

当需要更新到新版本时：

1. 备份当前配置：
   ```bash
   cp config.json config.json.backup
   ```

2. 从 npm 下载新版本并合并修复，或等待官方更新后手动应用修复。

3. 重启 pi 使更新生效。

## 文件结构

```
pi-permission-system/
├── index.ts           # 入口文件
├── package.json       # 包信息（参考）
├── config.json        # 配置文件
├── logs/              # 日志目录
└── src/               # 源代码
    ├── permission-manager.ts    # 权限管理（已修复）
    ├── wildcard-matcher.ts      # 通配符匹配（已修复）
    └── ...
```
