---
name: ccf-paper-mining
description: "面向 CCF 推荐会议（如 ICSE、FSE、ASE、ISSTA 等）的文献全集爬取、PDF 批量检索与方法架构图（Overview / Architecture / Workflow）高保真自动裁剪提取 Skill。当用户需要批量收集顶会论文全集、建立论文图库/绘图灵感库、或提取学术论文中的方法示意图时使用。"
---

# CCF Paper Mining & Overview Figure Extraction Skill

本 Skill 用于对 CCF 顶级学术会议进行**全集文献录用挖掘**、**PDF 自动化检索与补全**，以及**学术方法概览图（Overview / Architecture / Workflow）的高保真自动识别与裁剪**。

---

## 核心工作流三阶段

```
Stage 1: 官方全集发现 (Researchr) ──> Stage 2: 多源 PDF 检索下载 ──> Stage 3: 架构图定位与高保真裁剪
```

---

## 阶段一：官方会议录用全集发现（Researchr 爬取）

通过官方会议托管平台 `conf.researchr.org` 获取具有学术权威性的录用论文全集元数据，避免直接使用搜索引擎或 arXiv 导致的采样偏差。

### 1. 目标 URL 构造规则
- ICSE: `https://conf.researchr.org/track/icse-<YEAR>/icse-<YEAR>-research-track`
- FSE: `https://conf.researchr.org/track/fse-<YEAR>/fse-<YEAR>-research-papers`
- ASE: `https://conf.researchr.org/track/ase-<YEAR>/ase-<YEAR>-papers`
- ISSTA: `https://conf.researchr.org/track/issta-<YEAR>/issta-<YEAR>-technical-papers`

### 2. 全集提取脚本示例
```python
import urllib.request
import re

url = "https://conf.researchr.org/track/icse-2026/icse-2026-research-track"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req) as resp:
    html = resp.read().decode("utf-8", errors="ignore")

# 提取 /details/<conf>/<track>/<id>/<slug>
matches = re.findall(r'/details/([^\"]+)', html)
paper_details = list(dict.fromkeys([m for m in matches if 'research-track' in m or 'papers' in m]))
print(f"Extracted {len(paper_details)} papers from official track.")
```

---

## 阶段二：多通道 PDF 检索与下载

拿到全集标题后，采用双轨检索方案：

### 1. 开放预印本检索（arXiv API）
对于已在 arXiv 开放的论文，通过标题检索直接批量下载，无需登录认证：
```python
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET

def fetch_arxiv_pdf_by_title(title, save_path):
    clean_title = re.sub(r'[^a-zA-Z0-9 ]', '', title)
    query = f'ti:"{clean_title}" AND cat:cs.SE'
    url = f'http://export.arxiv.org/api/query?search_query={urllib.parse.quote(query)}&max_results=3'
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp:
        tree = ET.fromstring(resp.read())
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    for entry in tree.findall('atom:entry', ns):
        pdf_link = entry.find("atom:link[@title='pdf']", ns)
        if pdf_link is not None:
            pdf_url = pdf_link.attrib['href']
            urllib.request.urlretrieve(pdf_url, save_path)
            return True
    return False
```

### 2. 出版商页面认证通道（ACM DL / IEEE Xplore）
若论文未开放预印本，则根据 `ccf-paper-retrieval` 方案通过 CDP 打开出版商页面，用户完成机构认证后触发下载：
- 避免使用 `fetch().arrayBuffer()`（易超时崩溃）。
- 通过 DOM 注入原生 `<a download>` 节点触发 Chromium 原生流式下载。

---

## 阶段三：学术方法架构图定位与高保真自动裁剪

直接使用 `pdfimages` 提取往往只能获取内嵌的切片图标、折线散点，或者完全漏掉由 LaTeX TikZ/矢量代码绘制的复合流程图。因此必须使用**“页面版面定位 + 高清栅格化裁剪”**。

### 1. 定位目标页码与标题
在文本流中扫描包含核心学术图表标识的 Captions：
- **关键词**：`overview of`, `workflow of`, `architecture of`, `framework of`, `pipeline of`
- **编号**：`Figure 1`, `Figure 2`, `Fig. 1`, `Fig. 2`

```bash
pdftotext -f 1 -l 10 paper.pdf - | grep -i -E "(overview|workflow|architecture|framework)"
```

### 2. 借助 `pdftotext -bbox` 获取 Caption 坐标
```bash
pdftotext -bbox -f <PAGE> -l <PAGE> paper.pdf - | grep -i -E "(overview|architecture|workflow)"
```
- `yMin` 为标注文字所在的纵向坐标（单位为 PostScript points，72 points = 1 inch）。
- 学术流程图通常位于 Caption 的上方（页顶 `y=40` 到 Caption 之间）或整个双栏上方。

### 3. 高保真渲染与裁剪（Python + Poppler）
```python
import subprocess
from PIL import Image

dpi = 300
scale = dpi / 72.0

# 1. 渲染该页为 300 DPI 高清图
subprocess.run(['pdftoppm', '-png', '-r', str(dpi), '-f', str(page), '-l', str(page), pdf_path, '/tmp/render'])

# 2. 依据坐标裁剪
im = Image.open(f'/tmp/render-{page:02d}.png')
w, h = im.size

left_px = int(45 * scale)               # 去除页边距
right_px = int((w / scale - 45) * scale)
top_px = int(top_pt * scale)            # 通常为页眉下方 40~50pt
bottom_px = int((caption_y + 10) * scale) # 包含 Caption 说明文字

crop_im = im.crop((left_px, top_px, right_px, bottom_px))
crop_im.save(output_image_path)
```

---

## 规范输出与整理建议

提取的文件应结构化保存：
```
Documents/papers/top/
├── all_overviews/            # 集中图库：所有论文的核心 Overview/Architecture 图汇总（便于横向对比设计风格）
│   ├── <Conf>_<Title>_Fig1_Overview.png
│   └── ...
└── <Paper_Folder>/           # 单篇论文工程目录
    ├── <Paper_Title>.pdf     # 完整 PDF
    └── figures/              # 该论文所有提取的高清架构图与素材
```
