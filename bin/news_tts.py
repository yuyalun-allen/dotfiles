#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
news_tts.py - 将新闻摘要转换为语音并挂载字幕播放（默认使用 Edge-TTS）

特性:
  1. 默认采用 Edge-TTS 微软神经语音（默认音色: zh-CN-YunxiNeural 云希新闻主播音）
  2. 自动生成精准同步的 VTT/SRT 字幕
  3. 音频与字幕缓存至 XDG Cache 目录 (~/.cache/news-audio/)
  4. 使用 mpv 播放，终端显示实时字幕、时间进度条，支持空格暂停/播放、方向键快进退

用法:
    news_tts.py [YYYY-MM-DD 或 /path/to/YYYY-MM-DD.md] [--voice VOICE] [--force] [--text-only]
"""
import os, sys, re, shutil, subprocess, tempfile
from concurrent.futures import ThreadPoolExecutor
from tqdm import tqdm

DEFAULT_VOICE = "zh-CN-YunxiNeural"
DEFAULT_NEWS_DIR = os.path.expanduser("~/Desktop/rule-book/news")

# XDG Cache 目录
XDG_CACHE_HOME = os.environ.get("XDG_CACHE_HOME", os.path.expanduser("~/.cache"))
CACHE_DIR = os.path.join(XDG_CACHE_HOME, "news-audio")

def clean_text(text):
    # 去除 Markdown 链接与 URL
    text = re.sub(r'\[([^\]]*)\]\([^)]+\)', r'\1', text)
    text = re.sub(r'https?://\S+', '', text)
    # 去除多余括号及内容如（链接）、(link)
    text = re.sub(r'（[链接\s]*）', '', text)
    text = re.sub(r'\([link\s]*\)', '', text, flags=re.I)
    # 清理末尾未闭合的左括号
    text = re.sub(r'[（(][^）)]*$', '', text)
    # 去除加粗星号及反引号
    text = re.sub(r'[\*`]+', '', text)
    return text.strip()

def extract_tts_text(md_path):
    if not os.path.exists(md_path):
        return []
    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    tts_lines = []
    curr_h2 = ""
    curr_h3 = ""

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # 一级标题
        if line.startswith("# ") and not line.startswith("## "):
            title = line.lstrip("# ").strip()
            tts_lines.append(title + "。")
            continue

        # 二级标题
        if line.startswith("## "):
            curr_h2 = line.lstrip("# ").strip()
            curr_h2 = re.sub(r'^[^\w\u4e00-\u9fa5]+', '', curr_h2).strip()
            if curr_h2 == "今日要闻":
                tts_lines.append("今日要闻。")
            continue

        # 三级标题（小节源名称）
        if line.startswith("### "):
            curr_h3 = line.lstrip("# ").strip()
            tts_lines.append(f"小节，{curr_h3}。")
            continue

        # 今日要闻条目
        if curr_h2 == "今日要闻":
            c = clean_text(line)
            if c:
                tts_lines.append(c + ("。" if not c.endswith(("。", "！", "？", ".", "!", "?")) else ""))
            continue

        # 各源下的具体条目：提取破折号/冒号后的中文摘要
        if curr_h3 and (line.startswith("- ") or line.startswith("* ")):
            raw = line.lstrip("- *").strip()
            summary = ""
            for sep in [" — ", " - ", "：", ": "]:
                if sep in raw:
                    parts = raw.split(sep, 1)
                    summary = parts[1]
                    break
            if not summary:
                summary = raw

            cleaned = clean_text(summary)
            if re.search(r'[\u4e00-\u9fa5]', cleaned):
                tts_lines.append(cleaned + ("。" if not cleaned.endswith(("。", "！", "？", ".", "!", "?")) else ""))

    return tts_lines

def vtt_time_to_sec(t_str):
    parts = t_str.split(':')
    if len(parts) == 3:
        h, m, s = parts
    else:
        h = 0
        m, s = parts
    sec, ms = s.split('.') if '.' in s else (s, '0')
    return int(h) * 3600 + int(m) * 60 + int(sec) + int(ms) / 1000.0

def sec_to_vtt_time(seconds):
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    ms = int(round((seconds - int(seconds)) * 1000))
    if ms >= 1000:
        secs += 1
        ms -= 1000
    return f"{hrs:02d}:{mins:02d}:{secs:02d}.{ms:03d}"

def _synth_single_edge_tts(args):
    idx, text, voice = args
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f_mp3, \
         tempfile.NamedTemporaryFile(suffix=".vtt", delete=False) as f_vtt:
        mp3_tmp = f_mp3.name
        vtt_tmp = f_vtt.name

    cmd = [
        "edge-tts",
        "--voice", voice,
        "-t", text,
        "--write-media", mp3_tmp,
        "--write-subtitles", vtt_tmp
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    mp3_data = b""
    vtt_text = ""
    if os.path.exists(mp3_tmp):
        with open(mp3_tmp, 'rb') as f:
            mp3_data = f.read()
        os.remove(mp3_tmp)

    if os.path.exists(vtt_tmp):
        with open(vtt_tmp, 'r', encoding='utf-8', errors='ignore') as f:
            vtt_text = f.read()
        os.remove(vtt_tmp)

    return idx, text, mp3_data, vtt_text

def generate_edge_tts(text_lines, mp3_path, vtt_path, voice, date_label):
    if not shutil.which("edge-tts"):
        print("错误: 未找到 edge-tts 工具，请先运行: pipx install edge-tts", file=sys.stderr)
        return False

    os.makedirs(os.path.dirname(mp3_path), exist_ok=True)
    print(f"正在使用 Edge-TTS ({voice}) 合成语音 [{date_label}]（共 {len(text_lines)} 段）...")

    tasks = [(i, t, voice) for i, t in enumerate(text_lines)]
    results = [None] * len(tasks)

    # 采用多线程并发合成 + tqdm 实时进度条
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = [executor.submit(_synth_single_edge_tts, task) for task in tasks]
        for future in tqdm(futures, desc="合成进度", unit="段"):
            idx, text, mp3_data, vtt_text = future.result()
            results[idx] = (text, mp3_data, vtt_text)

    # 按原始段落顺序拼接音频与计算字幕时间轴
    total_mp3 = bytearray()
    total_vtt = ["WEBVTT\n"]
    cur_time = 0.0

    for idx, res in enumerate(results, 1):
        if not res:
            continue
        text, mp3_data, vtt_text = res
        total_mp3.extend(mp3_data)

        # 解析该段的字幕时长
        dur = 0.0
        for line in vtt_text.splitlines():
            m = re.match(r'(\d+:\d+[\d:.]*)\s*-->\s*(\d+:\d+[\d:.]*)', line)
            if m:
                end_s = vtt_time_to_sec(m.group(2))
                dur = max(dur, end_s)
        if dur <= 0.0:
            dur = max(1.0, len(text) * 0.25)

        start_vtt = sec_to_vtt_time(cur_time)
        end_vtt = sec_to_vtt_time(cur_time + dur)
        total_vtt.append(f"\n{idx}\n{start_vtt} --> {end_vtt}\n{text}\n")
        cur_time += dur

    with open(mp3_path, 'wb') as f:
        f.write(total_mp3)

    with open(vtt_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(total_vtt) + "\n")

    print(f"✓ 合成完成: {mp3_path} (时长 {int(cur_time // 60)}分{int(cur_time % 60)}秒)")
    return True

def play_audio(media_path, sub_path):
    if shutil.which("mpv"):
        cmd = ["mpv"]
        if os.path.exists(sub_path):
            cmd.append(f"--sub-file={sub_path}")
        cmd.append(media_path)
        print("播放提示: [Space]暂停/播放 | [←/→]快退/快进 | [[/]]调速 | [9/0]音量 | [q]退出")
        subprocess.run(cmd)
    elif shutil.which("pw-play"):
        subprocess.run(["pw-play", media_path])
    elif shutil.which("aplay"):
        subprocess.run(["aplay", "-q", media_path])
    else:
        print("错误: 未找到播放器 (mpv, pw-play, aplay)", file=sys.stderr)

def main():
    args = sys.argv[1:]
    target = None
    force = False
    text_only = False
    voice = DEFAULT_VOICE

    i = 0
    while i < len(args):
        a = args[i]
        if a == "--force":
            force = True
        elif a == "--text-only":
            text_only = True
        elif a == "--voice" and i + 1 < len(args):
            voice = args[i+1]
            i += 1
        elif not target and not a.startswith("-"):
            target = a
        i += 1

    if not target:
        import datetime
        target = datetime.date.today().isoformat()

    date_label = os.path.splitext(os.path.basename(target))[0]

    if not os.path.isfile(target):
        candidate = os.path.join(DEFAULT_NEWS_DIR, f"{date_label}.md")
        if os.path.isfile(candidate):
            target = candidate
        else:
            print(f"错误: 找不到新闻文件: {target}", file=sys.stderr)
            sys.exit(1)

    lines = extract_tts_text(target)
    if text_only:
        for idx, l in enumerate(lines, 1):
            print(f"[{idx}] {l}")
        return

    if not lines:
        print("未提取到可播报的中文内容。", file=sys.stderr)
        sys.exit(1)

    mp3_file = os.path.join(CACHE_DIR, f"{date_label}.mp3")
    vtt_file = os.path.join(CACHE_DIR, f"{date_label}.vtt")

    if not os.path.exists(mp3_file) or not os.path.exists(vtt_file) or force:
        success = generate_edge_tts(lines, mp3_file, vtt_file, voice, date_label)
        if not success:
            sys.exit(1)
    else:
        print(f"✓ 找到已有音频缓存: {mp3_file}")

    play_audio(mp3_file, vtt_file)

if __name__ == "__main__":
    main()
