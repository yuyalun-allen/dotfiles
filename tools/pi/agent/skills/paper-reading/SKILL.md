---
name: paper-reading
description: >-
  Use this skill whenever the user wants to read, summarize, or get insights from
  an academic paper. This includes: providing an arXiv URL and asking for a summary;
  uploading or pointing to a PDF of a paper and asking what it is about; asking
  to "read this paper", "summarize this for me", "帮我看看这篇论文", "总结这篇论文",
  or otherwise requesting a structured breakdown of a research paper. This skill
  is particularly designed for computer science papers (software engineering, AI/ML,
  systems), but works for any academic discipline. If the user shares a paper (via
  URL or file) and asks for analysis, summary, or understanding, use this skill.
  Do NOT use this skill for non-academic PDFs (reports, manuals, novels) - those
  should use the pdf skill instead.
---

# 论文阅读与总结指南

## 概述

本 skill 用于帮助用户阅读和总结学术论文（特别是计算机科学领域的论文）。当你被触发时，你的任务是：

1. **获取论文内容** — 从 arXiv URL 或 PDF 文件路径读取论文全文
2. **分析论文类型** — 判断是**方法研究**还是**经验研究**
3. **生成结构化总结** — 输出到 `<论文名>-summary.md` 文件中

## 工作流程

### 第一步：获取论文内容

根据用户提供的输入执行：

**场景 A：arXiv URL**（如 `https://arxiv.org/abs/XXXX.XXXXX` 或 `https://arxiv.org/pdf/XXXX.XXXXX`）

阅读 `scripts/extract_paper.py` 脚本了解其功能，然后运行：
```bash
python3 scripts/extract_paper.py --arxiv <URL> --output-dir <输出目录>
```
该脚本会：
- 从 arXiv API 获取论文元数据（标题、作者、摘要等）
- 下载 PDF 文件
- 提取全文文本
- 将元数据保存为 JSON，将全文保存为 TXT

**场景 B：PDF 文件路径**

先阅读 `scripts/extract_paper.py` 了解其功能，然后运行：
```bash
python3 scripts/extract_paper.py --pdf <PDF路径> --output-dir <输出目录>
```
脚本会提取论文标题（从 PDF 元数据或第一页）、作者信息、全文文本。

**关于论文标题的提取规则：**
- 脚本会自动从 arXiv API 或 PDF 元数据中提取标题
- 如果无法自动提取，用户会收到提示
- 最终的 `<论文名>-summary.md` 文件名中的 `论文名` 使用提取到的标题（或用户确认的标题），文件名中不应包含空格和特殊字符（用连字符或下划线替代）

### 第二步：阅读全文并分类

读取提取出的全文文本（`.txt` 文件），完整阅读论文。然后根据以下特征判断论文类型：

**方法研究（Methodological Research）** 的特征：
- 提出新的算法、模型、框架、系统、工具或方法
- 有明确的方法设计、技术贡献
- 包含理论分析或算法描述
- 通过实验验证方法的有效性

**经验研究（Empirical Research）** 的特征：
- 通过观察、实验或数据分析来回答研究问题
- 有明确的研究问题（Research Questions）
- 涉及数据收集（问卷调查、代码仓库挖掘、用户研究、案例研究等）
- 有系统的数据分析流程
- 可能不提出新方法，而是提供洞见、分类、模式或经验证据

如果论文同时包含两者，优先判断主要贡献类型。

### 第三步：生成结构化总结

将总结写入 `<论文名>-summary.md`，使用以下模板：

```markdown
# <论文标题>

> **论文类型**：方法研究 / 经验研究
> **作者**：作者列表
> **发表**：会议/期刊名称，年份
> **DOI/arXiv**：链接

## 摘要

（论文的摘要内容，中文翻译）

## 1. 研究背景与动机

- 论文试图解决什么问题？
- 为什么这个问题重要？
- 现有方法的局限性是什么？

## 2. 核心贡献

（列出论文的主要贡献点，2-5 条，每一条用一句话概括）

## 3. 方法/研究设计

### 3.1 方法概述

（如果论文是**方法研究**，这节描述：提出的方法/框架/系统的整体架构和核心思想）
（如果论文是**经验研究**，这节描述：研究设计、研究问题、研究对象）

### 3.2 关键设计/流程

- （方法研究）核心算法、模型结构、关键设计决策及其原理
- （经验研究）数据收集方法、数据来源、样本量、数据分析方法

### 3.3 数据集与实验设置

（方法研究）数据集描述、评估指标、基线方法、实验环境
（经验研究）数据特征、统计方法、效度威胁及缓解措施

## 4. 主要发现/实验结果

- 关键实验结果数据（用表格或列表呈现）
- 与基线的对比
- 消融实验或敏感性分析（如有）
- （经验研究）回答各研究问题的发现

## 5. 讨论与分析

- 作者对所提方法/发现的深入分析
- 适用范围和边界条件
- 意想不到的发现

## 6. 局限性与未来工作

- 论文的局限性
- 作者指出的未来方向
- 你认为值得进一步探索的点

## 7. 个人评价

（你的批判性分析，包括：）
- 论文的优点（创新性、方法论严谨性、实验充分性等）
- 论文的不足（可以改进的地方）
- 这篇论文对你的研究方向/实际工作的启发
- 推荐阅读人群

## 参考文献

- 论文中引用的重要相关工作（可选，列出 3-5 篇关键引用）
```

### 输出格式要求

1. **文件名**：`<论文名>-summary.md`，论文名使用纯文本（无空格无特殊字符，使用连字符），英文标题保留原文
2. **语言**：全文使用中文（摘要部分保留英文原文 + 中文翻译，其余全部中文）
3. **表格**：使用 Markdown 表格呈现实验数据
4. **代码/公式**：如果论文中有重要公式或伪代码，用 LaTeX 格式 $...$ 或 $$...$$ 展示
5. **引用标注**：在讨论具体论点时，标注对应论文中的章节号（如 §3.2）
6. **长度**：总字数约 1500-3000 字，确保全面但精炼

### 完成后

将生成的 `<论文名>-summary.md` 文件路径告知用户，并提供一句话的总结评价（例如"这是一篇高质量的 XXX 论文，值得一读"）。
