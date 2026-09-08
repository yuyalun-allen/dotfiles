---
name: ccf-paper-retrieval
description: "通过 Chrome DevTools Protocol (CDP) 与 CCF Rank 插件在 Google Scholar 检索特定 CCF 分级（CCF A/B/C）的计算机/软件工程学术论文，并协助用户处理付费墙认证、解析与直接下载 PDF 全文到本地。"
---

# CCF Paper Retrieval & Download Skill

本 Skill 用于借助本地 Chromium + CDP（Chrome DevTools Protocol）与 **CCF rank** 扩展，在 Google Scholar / DBLP 检索指定 CCF 等级论文，并处理机构认证及 PDF 全文自动化下载。

---

## 1. 架构与依赖

- **CDP 工具集**：`chrome_devtools_navigate`、`chrome_devtools_evaluate`、`chrome_devtools_select_page`、`chrome_devtools_list_pages`。
- **用户配置文件**：`~/.config/pi/agent/pi-chrome-devtools.json`
  ```json
  {
    "browser": {
      "executablePath": "/usr/bin/chromium",
      "extensionPaths": [
        "/home/allen/.config/chromium/Default/Extensions/pfcajmbenomfbjnbjhgbnbdjmiklnkie/4.6.0_0"
      ]
    }
  }
  ```
- **默认下载存储目录**：`~/Downloads/`

---

## 2. 检索工作流

### Step 1: 导航至 Google Scholar
使用 `chrome_devtools_navigate` 打开目标搜索页：
```javascript
// 示例：检索特定主题与会议/期刊
https://scholar.google.com/scholar?q=<query>
```

### Step 2: 过滤 CCF 分级
利用已加载的 CCF Rank 插件向 DOM 注入的 `.gs_rt` / 分级标记（如 `CCF A`、`CCF B` 等），在页面中解析：
```javascript
(() => {
  const items = Array.from(document.querySelectorAll('.gs_ri'));
  return items.map(el => {
    const titleEl = el.querySelector('.gs_rt');
    const metaEl = el.querySelector('.gs_a');
    const text = titleEl ? titleEl.innerText : '';
    const isCCFA = text.includes('CCF A');
    return {
      title: titleEl?.innerText.replace(/CCF [A-C]|CCF None/g, '').trim(),
      rawTitle: text,
      isCCFA,
      link: titleEl?.querySelector('a')?.href || '',
      meta: metaEl?.innerText.trim()
    };
  });
})()
```

---

## 3. 付费墙认证与 PDF 下载流程

### Step 1: 打开出版商页面并交由用户认证
1. 使用 `chrome_devtools_navigate` 打开论文详情页（如 IEEE Xplore, ACM DL, Springer Link, ScienceDirect 等）。
2. 提示用户在弹出的浏览器窗口中完成机构/个人认证（Institutional Login / Shibboleth / VPN）。

### Step 2: 定位 PDF / iframe 地址
在出版商页面提取实际 PDF 嵌入链接（如 IEEE 的 `stamp.jsp` 或 ACM 的 `pdf` 链接）：
```javascript
(() => {
  const iframe = document.querySelector('iframe');
  const pdfLinks = Array.from(document.querySelectorAll('a'))
    .filter(a => a.innerText.toLowerCase().includes('pdf') || a.href.includes('pdf') || a.href.includes('stamp.jsp'))
    .map(a => a.href);
  return { iframeSrc: iframe ? iframe.src : null, pdfLinks };
})()
```

### Step 3: 原生 DOM 点击触发流式下载（避坑指南）
> ⚠️ **避坑说明**：不要在 `Runtime.evaluate` 中使用 `fetch().arrayBuffer()` 转 Base64 下载大型 PDF，否则会因为大文件序列化与网络流传输导致 CDP evaluate 抛出超时错误。

**正确做法**：创建隐藏 `<a>` 标签由 Chromium 原生下载管道完成落盘：
```javascript
(() => {
  const iframe = document.querySelector('iframe');
  const targetUrl = iframe ? iframe.src : "<PDF_URL>";
  const a = document.createElement('a');
  a.href = targetUrl;
  a.download = "<paper_name>.pdf";
  document.body.appendChild(a);
  a.click();
  return 'download_triggered';
})()
```

### Step 4: 校验落盘文件
使用 Linux 命令行确认 `~/Downloads` 下文件生成及有效性：
```bash
ls -lat ~/Downloads | head -n 5
file ~/Downloads/<downloaded_file>.pdf
```
