#!/usr/bin/env bash
#
# summarize_news.sh - 先刷新 Liferea 订阅源，再运行分级摘要 summarize_news.py
# 用法: summarize_news.sh [YYYY-MM-DD] [--max-per-source N]
#
set -euo pipefail

# ---------- 1) 触发 Liferea 刷新所有源，并等待刷新完成 ----------
if pgrep -x liferea >/dev/null 2>&1; then
  echo "触发 Liferea 刷新所有订阅源..." >&2
  gdbus call --session --dest net.sourceforge.liferea \
    --object-path /net/sourceforge/liferea \
    --method org.gtk.Actions.Activate 'update-all' '[]' '{}' >/dev/null 2>&1 \
    || echo "（触发刷新失败，跳过等待）" >&2

  # 轮询 update_state.last_poll：开始增长后若连续 ~16s 无增长，视为刷新完成
  python3 - <<'PY' >&2
import sqlite3, time, os
DB = os.path.expanduser("~/.local/share/liferea/liferea.db")
def mp():
    try:
        c = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
        v = c.execute("SELECT MAX(last_poll) FROM update_state").fetchone()[0] or 0
        c.close(); return v
    except Exception:
        return 0
base = mp(); time.sleep(3); last = mp(); stable = 0; t0 = time.time()
while time.time() - t0 < 240:
    time.sleep(2); cur = mp()
    if cur > last:
        last = cur; stable = 0
    else:
        stable += 1
    if cur > base and stable >= 8:
        print(f"刷新完成（last_poll={cur}）", flush=True); break
else:
    print("等待刷新超时，继续摘要", flush=True)
PY
fi

# ---------- 2) 运行分级摘要 ----------
exec python3 "$HOME/.local/bin/summarize_news.py" "$@"
