#!/bin/bash
# pi-secrets: 安全密钥管理封装
# 基于 GNOME Keyring (secret-tool)

set -e

SERVICE="pi-agent"

usage() {
  cat <<EOF
用法：$0 <命令> [选项]

命令:
  set    存储密钥    --field <字段> [--label <标签>]
  get    读取密钥    --field <字段>
  list   列出所有密钥
  delete 删除密钥    --field <字段>
  export 导出为 JSON (用于 auth.json)

选项:
  --field <字段>     字段名 (如 refresh_token, api_key)
  --label <label>    描述标签
  --provider <名称>  提供者 (如 google-gemini-cli, anthropic)
  --type <类型>      类型 (oauth, api_key)
  --help             显示帮助

示例:
  $0 set --field refresh_token --provider google-gemini-cli --type oauth
  $0 get --field refresh_token
  $0 export > ~/.config/pi/agent/auth.json
EOF
}

get_field() {
  local field="$1"
  shift
  secret-tool lookup "$SERVICE" "$@" "$field" "$field"
}

set_field() {
  local field="" label="" provider="" type=""
  
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --field) field="$2"; shift 2 ;;
      --label) label="$2"; shift 2 ;;
      --provider) provider="$2"; shift 2 ;;
      --type) type="$2"; shift 2 ;;
      *) echo "未知选项：$1"; exit 1 ;;
    esac
  done
  
  if [[ -z "$field" ]]; then
    echo "错误：必须指定 --field"
    exit 1
  fi
  
  label="${label:-pi-agent-$field}"
  
  echo -n "请输入 $field 的值："
  read -s value
  echo
  
  if [[ -n "$provider" ]]; then
    secret-tool store --label="$label" \
      service "$SERVICE" \
      provider "$provider" \
      field "$field" \
      "$value"
  else
    secret-tool store --label="$label" \
      service "$SERVICE" \
      field "$field" \
      "$value"
  fi
  
  echo "✓ 已存储 $field"
}

list_secrets() {
  echo "pi-agent 存储的密钥:"
  secret-tool search --all service "$SERVICE" | grep -E '^(secret|attribute)' || echo "  (无)"
}

delete_field() {
  local field="$1"
  shift
  secret-tool clear "$SERVICE" "$@" "$field" "$field"
  echo "✓ 已删除 $field"
}

export_auth() {
  cat <<EOF
{
  "google-gemini-cli": {
    "type": "oauth",
    "refresh": "$(secret-tool lookup service "$SERVICE" provider "google-gemini-cli" field "refresh_token" 2>/dev/null || echo "")",
    "access": "$(secret-tool lookup service "$SERVICE" provider "google-gemini-cli" field "access_token" 2>/dev/null || echo "")",
    "expires": $(secret-tool lookup service "$SERVICE" provider "google-gemini-cli" field "expires" 2>/dev/null || echo "0"),
    "projectId": "$(secret-tool lookup service "$SERVICE" provider "google-gemini-cli" field "projectId" 2>/dev/null || echo "")"
  }
}
EOF
}

# 主逻辑
case "${1:-}" in
  set) shift; set_field "$@" ;;
  get) shift; get_field "$@" ;;
  list) list_secrets ;;
  delete) shift; delete_field "$@" ;;
  export) export_auth ;;
  --help|-h) usage ;;
  *) usage; exit 1 ;;
esac
