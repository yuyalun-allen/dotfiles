#!/usr/bin/env bash
# 列出 Zotero 集合内所有条目的 key/类型/标题/DOI/绝对路径（含重复检测）
# 用法: list_collection.sh <COLLECTION_KEY>
# 依赖: zotero-cli, python3
set -uo pipefail

COLLECTION_KEY="${1:?用法: list_collection.sh <COLLECTION_KEY>}"

command -v zotero-cli >/dev/null || { echo "zotero-cli 未找到，先 pipx install cli-anything-zotero" >&2; exit 1; }

zotero-cli --json collection items "$COLLECTION_KEY" 2>/dev/null | python3 -c "
import json, sys, subprocess
from collections import Counter

items = json.load(sys.stdin)
titles = [it.get('title') or '' for it in items]
dups = {t: n for t, n in Counter(titles).items() if n > 1}

print(f'条目数: {len(items)}')
if dups:
    print(f'⚠️ 重复标题: {dups}')
print()
print(f'{\"KEY\":<10}{\"TYPE\":<18}{\"TITLE\":<42}{\"DOI\":<28}PATH')

for it in items:
    key = it.get('key', '')
    path = it.get('attachmentPath', '')
    if path:
        # 尝试解析为绝对路径
        try:
            r = subprocess.run(['zotero-cli', '--json', 'item', 'file', key],
                               capture_output=True, text=True, timeout=15)
            resolved = json.loads(r.stdout).get('resolvedPath')
            if resolved:
                path = resolved
        except Exception:
            pass
    print(f'{key:<10}{str(it.get(\"typeName\",\"\")):<18}{(it.get(\"title\") or \"\")[:40]:<42}{it.get(\"DOI\",\"\"):<28}{path}')
" || echo "查询失败：集合 key 是否正确？Zotero 是否运行中？"
