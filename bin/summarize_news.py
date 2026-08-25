#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
summarize_news.py — 读取 Liferea 当天订阅内容，按「文件夹 → RSS源 → 文章」分级概括，
最终生成"今日要闻"。用 google/gemini-3.5-flash-lite 分步调用模型。

用法：
    summarize_news.py [YYYY-MM-DD] [--max-per-source N]
       不带日期默认今天；--max-per-source 限制每个源最多取 N 篇（默认 20）
输出：~/Desktop/rule-book/news/YYYY-MM-DD.md

分级流程：
    1) 源级：对每个有当天文章的 RSS 源，概括该源条目（标题+一句话摘要+链接）
    2) 文件夹级：对每个文件夹，汇总其下各源的摘要
    3) 全局：汇总所有文件夹摘要，提炼「今日要闻」5-8 条
"""
import os, sys, re, html, sqlite3, subprocess, tempfile, datetime

DB = os.path.expanduser("~/.local/share/liferea/liferea.db")
OUT_DIR = os.path.expanduser("~/Desktop/rule-book/news")
PROVIDER = "google"
MODEL = "gemini-3.5-flash-lite"

def clean(desc):
    d = desc or ""
    d = re.sub(r'<br\s*/?>', '\n', d, flags=re.I)
    d = re.sub(r'</p>', '\n', d, flags=re.I)
    d = re.sub(r'<[^>]+>', ' ', d)
    d = html.unescape(d)
    d = re.sub(r'[ \t]+', ' ', d)
    d = re.sub(r'\n\s*\n+', '\n', d)
    return d.strip()

def call_pi(prompt, context=""):
    # 用 --system-prompt 覆盖默认 coding-assistant 提示词，避免模型去查找文件/调用工具
    sysp = ("你是一个新闻摘要助手。只基于用户提供的文本内容进行概括总结，"
            "绝对不要查找文件、不要调用任何工具、不要输出代码块，直接输出 Markdown 正文。")
    args = ["pi", "--provider", PROVIDER, "--model", MODEL,
            "--no-tools", "--no-session", "--print",
            "--system-prompt", sysp]
    ctx = None
    if context:
        fd, ctx = tempfile.mkstemp(suffix=".txt")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(context)
        args += ["--append-system-prompt", ctx]
    args += [prompt]
    try:
        r = subprocess.run(args, capture_output=True, text=True, timeout=180)
        out = (r.stdout or "").strip()
    finally:
        if ctx and os.path.exists(ctx):
            os.unlink(ctx)
    m = re.fullmatch(r'```[a-zA-Z]*\s*\n?(.*?)\n?```', out, re.S)
    if m:
        out = m.group(1).strip()
    return out

def window_ts(date_str):
    # 归入日 D 的简报窗口 = [D-1 05:00, D 05:00]（即“昨天凌晨5点→今天凌晨5点”，给 D 日看）
    d = datetime.date.fromisoformat(date_str)
    end = datetime.datetime(d.year, d.month, d.day, 5, 0)
    start = end - datetime.timedelta(days=1)
    return int(start.timestamp()), int(end.timestamp())

def load(start_ts, end_ts):
    con = sqlite3.connect(DB)
    cur = con.cursor()
    rows = cur.execute("""
        SELECT f.title AS folder, n.title AS src, i.title, i.source, i.description
        FROM items i
        JOIN node n ON n.node_id = i.node_id
        LEFT JOIN node f ON f.node_id = n.parent_id
        WHERE i.date >= ? AND i.date < ?
        ORDER BY f.title, n.title, i.date DESC
    """, (start_ts, end_ts)).fetchall()
    con.close()
    folders = {}          # folder -> { src -> [ (title, link, body) ] }
    order = []
    for folder, src, title, link, desc in rows:
        folder = folder or "(未分类)"
        if folder not in folders:
            folders[folder] = {}
            order.append(folder)
        folders[folder].setdefault(src or "(未知源)", []).append(
            (title, link, clean(desc)))
    return order, folders

def source_block(folder, src, articles, maxn):
    items = articles[:maxn]
    lines = [f"源: {src}（{folder}）共 {len(articles)} 篇，取前 {len(items)} 篇："]
    for i, (t, l, b) in enumerate(items, 1):
        body = (b[:300] + "…") if len(b) > 300 else b
        lines.append(f"[{i}] {t}\n链接: {l}\n正文: {body}")
    return "\n".join(lines)

def main():
    args = sys.argv[1:]
    date = None
    maxn = 20
    for a in args:
        if re.fullmatch(r'\d{4}-\d{2}-\d{2}', a):
            date = a
        elif a.startswith("--max-per-source"):
            try:
                maxn = int(a.split("=")[1] if "=" in a else args[args.index(a)+1])
            except Exception:
                pass
    # 默认归入今天：窗口=[昨天05:00, 今天05:00]，即给今天看的简报；可手动传日期
    date = date or datetime.date.today().isoformat()
    start_ts, end_ts = window_ts(date)
    os.makedirs(OUT_DIR, exist_ok=True)
    out_file = os.path.join(OUT_DIR, f"{date}.md")

    order, folders = load(start_ts, end_ts)
    if not order:
        print(f"【{date}】窗口[{date} 前一天 05:00 → {date} 05:00] 内没有 Liferea 缓存的文章，已退出。", file=sys.stderr)
        sys.exit(1)

    print(f"窗口 前一天 05:00 → {date} 05:00（归入 {date}）："
          f"共 {sum(len(s) for f in folders.values() for s in f.values())} 篇文章，"
          f"{sum(len(s) for s in folders.values())} 个源，{len(order)} 个文件夹", file=sys.stderr)

    # ---------- 1) 源级概括 ----------
    src_summaries = {}   # (folder, src) -> markdown
    for folder in order:
        for src, articles in folders[folder].items():
            ctx = source_block(folder, src, articles, maxn)
            p = (f"你是新闻摘要助手。请概括下面「{folder} / {src}」当天({date})的订阅条目。"
                 "用 Markdown，格式：每条一行 '**标题** — 一句话中文摘要（链接）'。"
                 "如无实质内容就只列标题。直接输出，不要代码块。")
            try:
                src_summaries[(folder, src)] = call_pi(p, ctx)
                print(f"  源级完成: {folder} / {src}", file=sys.stderr)
            except Exception as e:
                print(f"  源级失败: {folder}/{src}: {e}", file=sys.stderr)
                src_summaries[(folder, src)] = "（该源概括失败）"

    # ---------- 2) 文件夹级汇总 ----------
    folder_md = {}       # folder -> markdown
    for folder in order:
        ctx = "\n\n".join(f"## {s}\n{src_summaries[(folder, s)]}"
                          for s in folders[folder])
        p = (f"请把「{folder}」文件夹下各 RSS 源的摘要整合为一份 Markdown 小节。"
             f"保留每个源为 ### 子标题，条目标题与链接都要保留，中文概括可精简。"
             f"不要代码块。")
        try:
            folder_md[folder] = call_pi(p, ctx)
            print(f"  文件夹级完成: {folder}", file=sys.stderr)
        except Exception as e:
            print(f"  文件夹级失败: {folder}: {e}", file=sys.stderr)
            folder_md[folder] = ctx

    # ---------- 3) 全局"今日要闻" ----------
    ctx = "\n\n".join(f"## {f}\n{folder_md[f]}" for f in order)
    p = (f"基于以下各文件夹的新闻摘要，提炼「{date}」今日要闻："
         "输出 5-8 条，每条格式 '**序号. 一句话要点** （来源）'，"
         "只保留最重要、最具信息量的新闻。直接输出 Markdown 列表，不要代码块。")
    try:
        top = call_pi(p, ctx)
        print("  今日要闻完成", file=sys.stderr)
    except Exception as e:
        print(f"  今日要闻失败: {e}", file=sys.stderr)
        top = "（今日要闻生成失败）"

    # ---------- 4) 组装输出 ----------
    parts = [f"# 今日新闻摘要（{date}）", "", "## 今日要闻", top.strip(), ""]
    for folder in order:
        parts += [f"## 📁 {folder}", "", folder_md[folder].strip(), ""]
    open(out_file, "w", encoding="utf-8").write("\n".join(parts) + "\n")
    print(f"已写入 {out_file}")

if __name__ == "__main__":
    main()
