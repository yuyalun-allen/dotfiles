#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bili_feed.py — 把关注的 Bilibili UP 主的最新视频聚合成一个 Atom feed，输出到 stdout。

用法：
    bili_feed.py [--max N]            # 输出 Atom（默认最多 40 条）
    bili_feed.py --check              # 自检：输出抓取统计，不生成 feed

Liferea 订阅方式：添加订阅时选 Advanced -> Source 类型选 Command，
Source 填本脚本绝对路径即可；每次刷新 Liferea 会运行它，实时输出聚合 feed。

依赖：Python 3 标准库。匿名调用 Bilibili API（自带 wbi 签名 + 保持 buvid session 抗反爬），无需登录 cookie。
关注列表固化在 feeds/bili_follows.json。
"""
import sys, os, json, time, hashlib, datetime, html, random, subprocess
import urllib.request, urllib.parse, http.cookiejar
from concurrent.futures import ThreadPoolExecutor

BASE = os.path.join(os.environ.get("XDG_DATA_HOME", os.path.expanduser("~/.local/share")), "rule-book-feeds")
FOLLOWS = os.path.join(BASE, "bili_follows.json")
COOKIES = os.path.join(BASE, "bili_cookies.json")
CACHE_DIR = os.path.join(os.environ.get("XDG_CACHE_HOME", os.path.expanduser("~/.cache")), "rule-book-feeds")
CACHE = os.path.join(CACHE_DIR, "bili_feed.cache")
TTL = int(os.environ.get("BILI_FEED_TTL", "1800"))
UA = "Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/130.0"

# Bilibili wbi 签名固定盐
MIXIN = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52]
_mixin = None

# 登录 cookie（若存在则使用，登录态请求反爬宽松、不易 412）
_cookie_str = None
def _load_cookies():
    global _cookie_str
    if _cookie_str is None:
        try:
            pairs = json.load(open(COOKIES, encoding="utf-8"))
            _cookie_str = "; ".join(f"{k}={v}" for k, v in pairs.items())
        except Exception:
            _cookie_str = ""
    return _cookie_str

# 带 CookieJar 的 opener：保持 buvid3 session，显著降低 412
_opener = None
def _get_opener():
    global _opener
    if _opener is None:
        cj = http.cookiejar.CookieJar()
        _opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
        _opener.addheaders = [('User-Agent', UA)]
        # 访问首页拿 buvid3/b_nut
        try:
            _opener.open("https://www.bilibili.com/", timeout=20)
        except Exception:
            pass
    return _opener

def _get_json(url, headers=None, retries=3):
    op = _get_opener()
    h = {'Referer': 'https://www.bilibili.com/', 'Accept': 'application/json'}
    ck = _load_cookies()
    if ck:
        h['Cookie'] = ck
    if headers: h.update(headers)
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=h)
            with op.open(req, timeout=15) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 412 and attempt < retries - 1:
                time.sleep(0.5 + 0.5*attempt)  # 反爬，退避重试
                continue
            raise
        except Exception:
            if attempt < retries - 1:
                time.sleep(0.8)
                continue
            raise

def _init_keys():
    global _mixin
    if _mixin:
        return
    d = _get_json("https://api.bilibili.com/x/web-interface/nav")
    img = d["data"]["wbi_img"]["img_url"].rsplit("/",1)[1].split(".")[0][:32]
    sub = d["data"]["wbi_img"]["sub_url"].rsplit("/",1)[1].split(".")[0][:32]
    _mixin = "".join((img+sub)[i] for i in MIXIN)[:32]

def _enc(params):
    return urllib.parse.urlencode(params, safe="!'()*")

def _wbi(params):
    _init_keys()
    params["wts"] = int(time.time())
    q = _enc(sorted(params.items()))
    params["w_rid"] = hashlib.md5((q+_mixin).encode()).hexdigest()
    return params

def latest_videos(mid, ps=2):
    """返回该 UP 主最新 ps 个视频；失败/反爬返回 []"""
    try:
        p = _wbi({"mid": mid, "ps": ps, "pn": 1})
        url = "https://api.bilibili.com/x/space/wbi/arc/search?" + _enc(p)
        d = _get_json(url)
        if d.get("code") != 0:
            return []
        return d["data"]["list"]["vlist"]
    except Exception:
        return []

def rfc3339(ts):
    return datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def esc(s):
    return html.escape(str(s), quote=False)

def build_atom(entries):
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    L = []
    L.append('<?xml version="1.0" encoding="utf-8"?>')
    L.append('<feed xmlns="http://www.w3.org/2005/Atom">')
    L.append('  <title>我的 Bilibili 关注动态</title>')
    L.append('  <id>tag:bilibili-feed,2026:/my-follows</id>')
    L.append(f'  <updated>{now}</updated>')
    L.append('  <link href="https://www.bilibili.com/"/>')
    L.append('  <subtitle>聚合自关注 UP 主的最新视频</subtitle>')
    for e in entries:
        bvid = e["bvid"]
        vurl = f"https://www.bilibili.com/video/{bvid}"
        L.append('  <entry>')
        L.append(f'    <title>{esc(e["title"])}</title>')
        L.append(f'    <id>tag:bilibili,{e["created"]}:{bvid}</id>')
        L.append(f'    <link href="{vurl}"/>')
        L.append(f'    <published>{rfc3339(e["created"])}</published>')
        L.append(f'    <updated>{rfc3339(e["created"])}</updated>')
        L.append(f'    <author><name>{esc(e.get("author") or e.get("uname") or "")}</name></author>')
        desc = (e.get("description") or "").strip() or e["title"]
        L.append(f'    <summary>{esc(desc[:500])}</summary>')
        L.append('  </entry>')
    L.append('</feed>')
    return "\n".join(L)

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

def main():
    args = sys.argv[1:]
    check = "--check" in args
    refresh = "--refresh" in args
    maxn = 40
    for a in args:
        if a.startswith("--max"):
            try: maxn = int(a.split("=")[1] if "=" in a else args[args.index(a)+1])
            except: pass
    if not os.path.exists(FOLLOWS):
        print("缺少关注列表文件: " + FOLLOWS, file=sys.stderr); sys.exit(1)
    follows = json.load(open(FOLLOWS, encoding="utf-8"))
    mids = [(f["mid"], f["uname"]) for f in follows]

    def _gather():
        all_entries = []
        # 低并发 + 限速，避免触发 B 站风控
        with ThreadPoolExecutor(max_workers=2) as ex:
            futures = {ex.submit(latest_videos, m): (m,u) for m,u in mids}
            for fut in futures:
                mid, uname = futures[fut]
                for v in fut.result():
                    v["mid"] = mid
                    v.setdefault("author", uname)
                    all_entries.append(v)
        seen = set(); entries = []
        for e in sorted(all_entries, key=lambda x: x["created"], reverse=True):
            if e["bvid"] in seen: continue
            seen.add(e["bvid"]); entries.append(e)
            if len(entries) >= maxn: break
        return all_entries, entries

    if refresh:
        _, entries = _gather()
        _save_cache(entries)
        return

    if check:
        all_entries, entries = _gather()
        ok = sum(1 for e in all_entries if (e.get("description") or "").strip())
        print(f"UP主数: {len(follows)}; 抓取到视频: {len(all_entries)}; 含简介: {ok}; 输出: {len(entries)} 条")
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
