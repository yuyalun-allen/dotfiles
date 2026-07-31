---
name: literature-management
description: "基于 zotero-cli 管理用户的 Zotero 文献库（搜索、导入、整理、导出、定位文件）。当用户提到'论文'、'文献'、'文章'、'参考文献'、'引用'、'citation'、'Zotero'、'DOI'、'arXiv'、'bibtex'、'文献库'等词，或要求把 PDF 存进文献库、搜索/查找某篇论文、列出某集合里的文章、给论文打标签、导出引用格式、补全文献元数据时，必须使用本 skill——即使任务看起来很简单。本 skill 包含连接 Zotero 桌面版的桥接前置检查、已验证的命令速查、批量处理脚本，以及大量实测避坑经验（如 add file 不提取元数据、空串搜索无效、数据目录位置等），不使用本 skill 很容易在这些坑上浪费时间。"
---

# 文献管理 Skill

管理用户 Zotero 文献库的唯一入口。底层是 `zotero-cli`（CLI Bridge 方案），写入走本地桥接，**不需要 API key，但 Zotero 桌面版必须运行**。

## 你的角色

用户是软件工程/CS 方向博士生，文献库在 Zotero 里，按研究主题分了大量集合（如 `researcher/` 下有 `版本控制`、`LLM`、`代码生成` 等，集合树可能很深）。你的工作是代替用户完成所有文献相关的琐碎操作：找文献、存文献、整理集合、导出引用、定位 PDF。

## 前置检查（每次任务先做，30 秒内完成）

```bash
command -v zotero-cli && zotero-cli --json app ping   # 桥接可用？
```

- `zotero-cli` 安装在 `~/.local/bin`（pipx），失败则提示安装：`pipx install cli-anything-zotero`
- `app ping` 返回 `connector_available: true` 表示 Zotero 桌面版在运行；失败则提醒用户打开 Zotero，必要时 `zotero-cli app plugin-status` 检查桥接插件
- 环境事实：Zotero 9.x，数据目录在 **`~/Zotero/storage/<ITEM_KEY>/`**（不是 `~/.zotero/...`，那是 profile 目录）

## 核心原则

1. **先读后写，破坏性操作必确认**：导入、打标签这类低风险操作直接做；删除（`item delete`）、合并、移动集合、批量修改这类不可逆或影响面大的操作，先展示计划并得到用户明确同意。删除命令本身有 `--confirm` 防护，没有防护的操作更要谨慎。
2. **一律 `--json`**：所有命令加 `--json` 拿结构化输出，用 `python3` 解析，不要肉眼读混合输出。
3. **Zotero 桌面版必须运行**：桥接写入依赖它。任务开始前 `app ping` 确认，失败不要硬跑。
4. **先验证再批量**：批量操作前先用 1 个文件/条目测试，确认行为符合预期（尤其是导入类）。

## 命令速查

详细参考见 `references/commands.md`（含完整子命令列表）。核心命令：

| 任务 | 命令 |
|------|------|
| 搜索条目 | `zotero-cli --json item find "关键词" [--scope fields]` |
| 全文搜索 | `zotero-cli --json item search-fulltext "词"` |
| 单条目元数据 | `zotero-cli --json item get KEY` |
| 文件绝对路径 | `zotero-cli --json item file KEY` → `resolvedPath` |
| 集合树 | `zotero-cli --json collection tree` |
| 列集合条目 | `zotero-cli --json collection items KEY` |
| 建集合 | `zotero-cli collection create "名字" --parent 父KEY` |
| 导入 DOI | `zotero-cli --json add doi "10.xxxx/yyyy" [--collection KEY] [--tag T] [--fetch-pdf]` |
| 导入 arXiv | `zotero-cli --json add arxiv 2602.02093 [--collection KEY]` |
| 导入 PDF 文件 | `zotero-cli --json add file 路径.pdf [--collection KEY] [--tag T]` |
| 导入 BibTeX | `zotero-cli --json add bibtex refs.bib [--collection KEY]` |
| 导出 BibTeX | `zotero-cli export bib --items K1,K2 --output refs.bib` |
| 删除条目 | `zotero-cli --json item delete KEY --confirm` |
| 条目 LLM 上下文 | `zotero-cli --json item context KEY` |
| 查重复 | `zotero-cli --json item duplicates` |
| 审计写入 | `zotero-cli --json audit tail --limit 20` |

## 常用工作流

### 1. 搜索文献
```bash
zotero-cli --json item find "merge conflict"          # 关键词
zotero-cli --json item find "neural" --scope fields   # 限定字段
zotero-cli --json item search-fulltext "CRISPR"       # 全文
```
用户说"找论文/查文献"时，先搜，再展示标题+年份+DOI 清单。

### 2. 导入文献（用户说"把这篇存进文献库"）
- 给了 **DOI**：`add doi`（会带元数据，`--fetch-pdf` 可自动找 PDF）
- 给了 **arXiv 号**：`add arxiv`
- 给了 **本地 PDF**：`add file` ⚠️ 注意它只建独立附件、不提取元数据（见避坑 #1），且要 `--collection` 放对集合
- 给了 **BibTeX/RIS 文件**：`add bibtex`
- 导入后告诉用户新条目的 key 和存放位置

### 3. 集合管理
```bash
zotero-cli collection tree                          # 先看现有结构
zotero-cli collection create "新集合" --parent 父KEY
zotero-cli --json collection items KEY              # 查看集合内容
```
父集合用 `collection get KEY` 确认层级。用户提到"XX 目录/文件夹"通常指 Zotero 集合。

### 4. 批量导入目录中的 PDF
无内置批量命令，用脚本循环（参考 `scripts/`，先小批量测试 1-2 个）：
```bash
cd 目录 && for f in *.pdf; do zotero-cli --json add file "$f" --collection KEY --tag T >> /tmp/import.log; done
```
文件名带空格必须加引号。结束后用 `collection items` 核对数量、查重复。

### 5. 定位 PDF 文件（用户要本地路径）
```bash
zotero-cli --json item file KEY          # resolvedPath = /home/allen/Zotero/storage/KEY/xxx.pdf
scripts/list_collection.sh 集合KEY       # 批量：集合内所有条目的 key/标题/DOI/绝对路径 + 重复检测
```

### 6. 导出/引用
```bash
zotero-cli --json item export KEY --format bibtex
zotero-cli export bib --items K1,K2 --output refs.bib
zotero-cli --json item citation KEY      # 格式化引用
zotero-cli --json item context KEY       # LLM 可用的文献上下文（写论文时用）
```

## 实战避坑（全是实测教训）

1. **`add file` 不提取元数据**：创建的是 standalone attachment，`title`=文件名，`creators`/`DOI`/`date` 全空。要带元数据的条目，优先 `add doi`/`add arxiv`/`add bibtex`；只有扫描 PDF 时才用 `add file`。补元数据可尝试 `Zotero.RetrieveMetadata`（`zotero-cli js` 调用），但扫描件成功率低。
2. **空字符串搜索无效**：`item find ""` 返回空数组，不能用于"列出全部"。列集合用 `collection items KEY`。
3. **重复导入不去重**：同一文件/DOI 加两次会产生两个条目。批量后必须查重复（`item duplicates` 或脚本内 Counter 检测），测试+正式导入最容易产生重复，要及时删掉测试产生的副本。
4. **`item file` 是拿绝对路径的正道**：返回 `resolvedPath` + `exists` 布尔。`attachmentPath` 的 `storage:` 前缀要解析到 `~/Zotero/storage/<KEY>/<文件名>`。
5. **假 PDF**：有些 `.pdf` 扩展名文件实际是 HTML（用 `file` 命令可查），导入后打不开。批量导入前先 `file *.pdf` 抽查。
6. **删除要 `--confirm`**：`item delete KEY` 会被拒，需 `--confirm`。这是防护设计，删除前仍要用户同意。
7. **集合 itemCount 可能虚高**：`collection get` 的 `itemCount` 是缓存值，可能与 `collection items` 实际数不一致，以 `collection items` 为准。
8. **导入前先测试**：新环境/新文件类型先加 1 个，看 `code`（如 `ATTACHED_STANDALONE`）是否符合预期，再批量。

## 与用户沟通

- 中文回复；用 `--json` 数据说话，展示 key、标题、路径
- 导入/搜索完成后，简短汇报：做了什么事、新条目 key、存放集合、注意事项（如"附件无元数据"）
- 遇到需要用户决定的事（是否删除重复、是否补提元数据），给出选项而不是自作主张

## 资源

- `references/commands.md` — 完整命令参考（zotero-cli --help 全量整理）
- `scripts/list_collection.sh` — 批量列出集合条目的路径+元数据表格（含重复检测）
