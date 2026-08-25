#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
yt_feed.py — 把你订阅的 YouTube 频道的最新视频聚合成一个 Atom feed，输出到 stdout。

为什么需要它：YouTube 官方 RSS 里每个条目的简介放在 <media:description> 命名空间，
Liferea 不解析该命名空间，所以只显示标题。本脚本抓取官方 RSS 后，
把 media:description 转成标准 <summary>，Liferea 即可显示简介。

用法：
    yt_feed.py [--max N]        # 输出 Atom（默认最多 40 条）
    yt_feed.py --check          # 自检：输出抓取统计

Liferea 订阅：Advanced -> Source 类型选 Command，Source 填本脚本绝对路径。
依赖：Python 3 标准库。直接抓 YouTube 官方 RSS（feeds/videos.xml），无需 cookie/登录。
频道列表固化在 feeds/youtube_channels.json（name -> channel_id）。
"""
import sys, os, json, datetime, html, re, time, subprocess
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

BASE = os.path.join(os.environ.get("XDG_DATA_HOME", os.path.expanduser("~/.local/share")), "rule-book-feeds")
CHANNELS = os.path.join(BASE, "youtube_channels.json")
CACHE_DIR = os.path.join(os.environ.get("XDG_CACHE_HOME", os.path.expanduser("~/.cache")), "rule-book-feeds")
CACHE = os.path.join(CACHE_DIR, "yt_feed.cache")
TTL = int(os.environ.get("YT_FEED_TTL", "1800"))  # 缓存新鲜时间(秒)
UA = "Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/130.0"

ATOM = "http://www.w3.org/2005/Atom"
MEDIA = "http://search.yahoo.com/mrss/"
YT = "http://www.youtube.com/xml/schemas/2015"

def _get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()

def fetch_channel(channel_id):
    """抓取单个频道官方 RSS，返回 entry dict 列表"""
    try:
        raw = _get(f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}")
        root = ET.fromstring(raw)
    except Exception:
        return []
    out = []
    for e in root.findall(f"{{{ATOM}}}entry"):
        def t(tag):
            el = e.find(f"{{{ATOM}}}{tag}")
            return el.text.strip() if el is not None and el.text else ""
        def a(tag):
            el = e.find(f"{{{ATOM}}}{tag}")
            return el.text.strip() if el is not None and el.text else ""
        title = t("title")
        link = e.find(f"{{{ATOM}}}link")
        href = link.get("href") if link is not None else ""
        published = a("published") or a("updated")
        author = ""
        au = e.find(f"{{{ATOM}}}author/{{{ATOM}}}name")
        if au is not None and au.text: author = au.text.strip()
        # media:group/media:description
        desc = ""
        mg = e.find(f"{{{MEDIA}}}group")
        if mg is not None:
            md = mg.find(f"{{{MEDIA}}}description")
            if md is not None and md.text: desc = md.text.strip()
        if not title: continue
        out.append({"title": title, "link": href, "published": published,
                    "author": author, "summary": desc})
    return out

def rfc3339(s):
    # 输入已是 RFC3339
    return s

def _load_cache():
    # 只要有缓存文件就返回（不看 TTL）；TTL 只用于决定是否后台刷新
    try:
        d = json.load(open(CACHE, encoding="utf-8"))
        return d.get("entries") or None
    except Exception:
        return None

def _cache_age():
    try:
        return time.time() - json.load(open(CACHE, encoding="utf-8"))["ts"]
    except Exception:
        return float("inf")

def _save_cache(entries):
    try:
        os.makedirs(CACHE_DIR, exist_ok=True)
        json.dump({"ts": time.time(), "entries": entries}, open(CACHE, "w", encoding="utf-8"))
    except Exception:
        pass

def _spawn_refresh():
    # 后台异步刷新缓存（脱离会话，不被 Liferea 终止）；避免阻塞下次刷新
    try:
        subprocess.Popen([sys.executable, os.path.abspath(__file__), "--refresh"],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                         stdin=subprocess.DEVNULL, start_new_session=True)
    except Exception:
        pass

def esc(s):
    return html.escape(str(s), quote=False)

def build_atom(entries):
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    L = []
    L.append('<?xml version="1.0" encoding="utf-8"?>')
    L.append('<feed xmlns="http://www.w3.org/2005/Atom">')
    L.append('  <title>我的 YouTube 订阅动态</title>')
    L.append('  <id>tag:youtube-feed,2026:/my-subs</id>')
    L.append(f'  <updated>{now}</updated>')
    L.append('  <link href="https://www.youtube.com/"/>')
    L.append('  <subtitle>聚合自订阅频道的最新视频</subtitle>')
    for e in entries:
        L.append('  <entry>')
        L.append(f'    <title>{esc(e["title"])}</title>')
        L.append(f'    <id>tag:youtube,{esc(e["link"])}</id>')
        L.append(f'    <link href="{esc(e["link"])}"/>')
        L.append(f'    <published>{e["published"]}</published>')
        L.append(f'    <updated>{e["published"]}</updated>')
        L.append(f'    <author><name>{esc(e.get("author") or "")}</name></author>')
        L.append(f'    <summary>{esc(e.get("summary") or "")}</summary>')
        L.append('  </entry>')
    L.append('</feed>')
    return "\n".join(L)

def main():
    args = sys.argv[1:]
    check = "--check" in args
    refresh = "--refresh" in args
    maxn = 40
    for a in args:
        if a.startswith("--max"):
            try: maxn = int(a.split("=")[1] if "=" in a else args[args.index(a)+1])
            except: pass
    if not os.path.exists(CHANNELS):
        print("缺少频道列表文件: " + CHANNELS, file=sys.stderr); sys.exit(1)
    chans = json.load(open(CHANNELS, encoding="utf-8"))

    def _gather():
        all_entries = []
        with ThreadPoolExecutor(max_workers=8) as ex:
            results = ex.map(lambda cid: fetch_channel(cid), chans.values())
            for lst in results:
                all_entries.extend(lst)
        seen = set(); out = []
        for e in sorted(all_entries, key=lambda x: x["published"], reverse=True):
            if e["link"] in seen: continue
            seen.add(e["link"]); out.append(e)
            if len(out) >= maxn: break
        return all_entries, out

    if refresh:
        _, entries = _gather()
        _save_cache(entries)
        return

    if check:
        all_entries, entries = _gather()
        ok = sum(1 for e in all_entries if e.get("summary"))
        print(f"频道数: {len(chans)}; 抓取到视频: {len(all_entries)}; 含简介: {ok}; 输出: {len(entries)} 条")
        return

    cached = _load_cache()
    if cached is not None:
        if _cache_age() > TTL:
            _spawn_refresh()   # 后台异步刷新，不阻塞本次（避免 Liferea 504）
        sys.stdout.write(build_atom(cached[:maxn]))
        sys.stdout.write("\n")
        return
    # 无缓存冷启动：同步抓取一次
    _, entries = _gather()
    _save_cache(entries)
    sys.stdout.write(build_atom(entries))
    sys.stdout.write("\n")

if __name__ == "__main__":
    main()
