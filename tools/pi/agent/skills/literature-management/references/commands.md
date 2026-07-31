# zotero-cli 完整命令参考

> 环境事实：zotero-cli v1.2.1（pipx 安装），Zotero 9.x，数据目录 `~/Zotero/storage/<KEY>/`
> 所有命令前可加 `--json` 获得结构化输出。`REF` 处可用 item key / collection key。

## app — 运行时检查

| 命令 | 用途 |
|------|------|
| `app ping` | 桥接/连接器是否可用（任务前置检查） |
| `app status` | 综合状态 |
| `app plugin-status` | Bridge 插件是否安装、端点是否激活 |
| `app doctor` | 诊断 Zotero + Bridge 就绪度（docx 动态引用前必跑） |
| `app launch` | 启动 Zotero 并等待 |
| `app enable-local-api` | 启用本地 API |
| `app install-plugin` | 安装/升级 Bridge 插件（首次需在 Zotero GUI 手动装 .xpi 并重启） |
| `app uninstall-plugin` | 卸载插件 |
| `app check-update` | 检查新版本 |
| `app version` | 版本号 |

## collection — 集合

| 命令 | 用途 |
|------|------|
| `collection tree` | 集合树（含 itemCount、key），了解库结构首选 |
| `collection get REF` | 集合详情（collectionID/name/parent/itemCount） |
| `collection create NAME --parent KEY` | 建集合（--parent 建子集合） |
| `collection rename KEY [--name N] [--parent P]` | 改名/移动（JS bridge） |
| `collection delete KEY [--delete-items] --confirm` | 删集合（--delete-items 连条目一起删） |
| `collection items REF` | **列集合内条目**（itemID/key/title/DOI/typeName/attachmentPath…） |
| `collection stats REF` | 集合统计（总数/PDF 数/年份/期刊分布） |
| `collection find QUERY` | 按名找集合 |
| `collection list` | 平铺列表 |
| `collection remove-item COLL KEY` | 从集合移除条目（**不删除条目本身**） |
| `collection fetch-pdfs REF [--limit N]` | 批量给缺 PDF 条目找 PDF（Zotero + OA 级联） |
| `collection find-pdfs REF` | 同上（JS bridge 单条循环） |

## item — 条目

### 查找
| 命令 | 用途 |
|------|------|
| `item find QUERY [--collection K] [--limit N] [--scope fields] [--exact-title]` | 关键词搜索。⚠️ 空字符串返回空数组，列集合用 `collection items` |
| `item search-fulltext QUERY` | PDF 全文搜索（JS bridge） |
| `item search-annotations QUERY [--color C]` | 按标注关键词/颜色搜索 |
| `item semantic-search QUERY [--top-k N]` | 本地嵌入语义搜索（需先 `item build-index`） |
| `item similar KEY` | 相似文献（嵌入） |
| `item duplicates [--by doi\|title]` | 查重复条目 |
| `item list [--limit N]` | 平铺列表 |
| `item get REF` | **单条目完整元数据**：title/typeName/DOI/date/creators/tags/attachmentPath |
| `item children REF` / `item attachments REF` | 子条目 / 附件列表 |
| `item notes REF` / `item annotations KEY` | 笔记 / 标注 |

### 文件
| 命令 | 用途 |
|------|------|
| `item file REF` | **绝对路径**：返回 `path`（storage: 逻辑）+ `resolvedPath`（/home/allen/Zotero/storage/KEY/xxx.pdf）+ `exists` |
| `item attach KEY PDF_PATH` | 给已有条目附加本地 PDF |
| `item fetch-pdf KEY [--sources zotero,unpaywall,arxiv]` | 给单条目找 PDF 并附加 |
| `item find-pdf KEY` | 触发 Zotero 原生 "Find Available PDF" |

### 导出/引用
| 命令 | 用途 |
|------|------|
| `item export REF --format bibtex` | 导出为 BibTeX/CSL-JSON 等 |
| `item citation REF [--style APA]` | 格式化引用 |
| `item bibliography REF` | 参考文献格式 |
| `item context REF [--include-bibtex]` | **LLM 就绪上下文**（写论文/综述时用） |
| `item metrics REF [--pmid]` | NIH iCite 引用指标 |
| `item analyze REF [--question Q]` | LLM 分析文献 |

### 写入
| 命令 | 用途 |
|------|------|
| `item tag KEY --add T [--remove T]` | 加/删标签 |
| `item update KEY --field 字段=值` | 改元数据字段 |
| `item delete KEY --confirm` | **永久删除**（必须 --confirm，先征得用户同意） |
| `item merge KEEP_KEY MERGE_KEYS [--dry-run]` | 合并重复条目（子条目移入、并标签、其余进回收站） |
| `item add-to-collection REF COLL_REF` | 加入集合 |
| `item move-to-collection REF COLL_REF` | 移入集合（可 --from 指定原集合） |
| `item build-index` | 构建语义搜索向量索引 |

## add — 统一导入（首选入口）

| 命令 | 用途 |
|------|------|
| `add doi DOI [--collection K] [--tag T] [--fetch-pdf] [--pdf-sources ...]` | DOI 导入，**带完整元数据** |
| `add arxiv ID [--collection K] [--tag T] [--fetch-pdf]` | arXiv 导入 |
| `add file 路径 [--collection K] [--tag T] [--if-exists file\|skip\|duplicate]` | PDF/Bib/RIS/JSON 导入。⚠️ PDF 只建 standalone attachment，**不提取元数据** |
| `add url URL [--collection K] [--fetch-pdf]` | 网页/arXiv/DOI 链接导入 |
| `add bibtex refs.bib [--collection K] [--tag T]` | BibTeX 文件导入 |

## import — 底层导入（add 的补充）

| 命令 | 用途 |
|------|------|
| `import doi DOI [--dedupe] [--if-exists ...]` | 底层 DOI 导入（--translator 用内置翻译器） |
| `import file PATH [--split-bib]` | 底层文件导入（BibTeX 多条目可 --split-bib 拆分） |
| `import pmid PMID` | PubMed ID 导入 |
| `import json PATH` | CSL-JSON 导入 |

## export — 导出

| 命令 | 用途 |
|------|------|
| `export bib [--items K1,K2] [--collection K] [--format bibtex\|biblatex] [--output f]` | 导出独立 BibTeX 文件（支持整集合导出） |

## docx — Word 文档引用

| 命令 | 用途 |
|------|------|
| `docx inspect-placeholders draft.docx` | 检查文档里的 `{{zotero:KEY}}` 占位符 |
| `docx validate-placeholders draft.docx` | 校验占位符是否都能在库中找到 |
| `docx render-citations draft.docx` | 占位符 → **静态**引文+文献表（只需 pip+Bridge，推荐默认） |
| `docx cite draft.docx --output out.docx --mode auto` | 一键流水线（auto=动态栈就绪用动态，否则静态） |
| `docx insert-citations draft.docx` | 占位符 → 可刷新的 Zotero 动态字段（需 LibreOffice + Zotero LO 插件） |
| `docx doctor` | 检查动态模式依赖（LibreOffice/LO 插件/Bridge） |
| `docx prepare-zotero-import` / `zotery` 系列 | 实验性 Zotero 传输格式 |

## 其他

| 命令 | 用途 |
|------|------|
| `js "return Zotero.version"` | 在 Zotero 里执行任意 JS（高级操作逃生门） |
| `note add REF --text "..."` | 给条目加子笔记 |
| `sync` | 触发同步 |
| `audit tail --limit N` | 查看最近写入操作审计日志 |
| `tag list` / `tag items TAG` | 标签管理 |
| `style list` | 已装 CSL 样式 |
| `session use-collection KEY` | 设置会话默认集合（后续命令省略 REF） |
| `repl` | 交互式 REPL |

## 全局选项

- `--json` 结构化输出
- `--backend [auto|sqlite|api]` 后端选择（默认 auto）
- `--data-dir` / `--profile-dir` / `--executable` 显式指定路径

## 常见 JSON 字段

- `attachmentPath`: `storage:文件名.pdf`（逻辑路径，需解析为 `~/Zotero/storage/<KEY>/文件名.pdf`）
- `typeName`: attachment / conferencePaper / journalArticle / preprint / book …
- `itemTypeID` 3 = attachment；`linkMode` 0 = stored（已存 storage）
- `code`（add file 返回）: `ATTACHED_STANDALONE` = 独立附件
