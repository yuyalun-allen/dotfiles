#!/bin/bash
# load-secret-keys.sh - 从 GNOME Keyring 安全加载密钥到环境变量
# 用法：source ~/.config/environment.d/load-secret-keys.sh

# 从 GNOME Keyring 加载密钥（加密存储，按需解密）
export DASHSCOPE_API_KEY=$(secret-tool lookup service 'dashscope' field 'api_key' 2>/dev/null)

# 验证是否加载成功
if [[ -z "$DASHSCOPE_API_KEY" ]]; then
  echo "⚠️ 警告：无法从 GNOME Keyring 加载 DASHSCOPE_API_KEY" >&2
  echo "请先运行：secret-tool store --label='DashScope API Key' service 'dashscope' field 'api_key'" >&2
  return 1 2>/dev/null || exit 1
fi

# 加载成功后，不输出任何内容（保持安静）
# echo "✓ 已加载密钥到环境变量"
