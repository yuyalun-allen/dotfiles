---
name: academic-writing-cs-se
description: Assists with writing, revising, and polishing computer science / software engineering research papers in English (venues like ICSE, FSE, ASE, TSE, TOSEM, ISSTA, etc.). Use this skill whenever the user is drafting, translating, or editing an academic paper section (abstract, introduction, related work, approach/methodology, evaluation, discussion, threats to validity, conclusion), asking for help making writing "more academic" / "more professional" / "sound more native", fixing Chinglish or awkward phrasing, tightening claims, adding hedging language, checking tense/voice consistency, or preparing a paper for submission to a CS/SE conference or journal. Trigger even if the user just pastes a paragraph and asks to "improve" or "polish" it, or asks about academic writing conventions, without explicitly saying "SKILL" or naming this file.
---

# 学术论文写作（计算机科学 / 软件工程方向）

面向英文 CS/SE 学术论文（会议如 ICSE/FSE/ASE/ISSTA，期刊如 TSE/TOSEM/EMSE 等）的写作辅助技能。目标是让 agent 在**润色、撰写、翻译**论文内容时，主动应用学术英语的表达规范，而不是简单地把中文直译成英文，或写出流畅但"不够学术"的散文体。

## 何时深入阅读参考文件

- 需要具体某一节（Abstract / Intro / Related Work / Approach / Evaluation / Threats to Validity / Conclusion）的惯用句式和过渡表达 → 阅读 `references/section-phrasebank.md`
- 用户的初稿明显带有中式英语痕迹，需要系统性纠错 → 阅读 `references/chinglish-pitfalls.md`

不需要每次都读完整份参考文件——先看本文件里的总则，缺具体表达时再按需查表。

---

## 一、语域与总体风格（Register）

CS/SE 论文属于**正式书面英语**，介于纯理论数学论文（极度浓缩）和工程技术文档（面向操作）之间。核心原则：

1. **客观优先于生动**。不用感叹句、修辞问句、比喻煽情式表达。"This is a huge problem" → "This remains an open and impactful problem."
2. **精确优先于华丽**。少用同义词堆砌来"显得学术"；同一个概念全文用同一个术语，不要为了"避免重复"而换词（这是学术写作和文学写作最大的区别之一）。
3. **简洁优先于完整从句**。能用名词短语就不用从句：`the approach that we propose` → `our approach` / `the proposed approach`。
4. **可证伪的表述优先于绝对化表述**。避免 always / never / all / completely / perfectly / trivial / obviously，除非确有依据；改用 hedging（见下）。
5. **禁止口语化**：no contractions（don't → do not），no phrasal filler（kind of, basically, a lot of → considerably / substantially），no rhetorical "you"。

---

## 二、语法与用词层面的具体规则

### 1. 时态（Tense）——按段落功能而非全文统一

这是中国作者最常犯的错误之一：整篇论文用一个时态。正确做法是**按语义功能切换**：

| 场景 | 时态 | 示例 |
|---|---|---|
| 描述本文所做的工作、贡献 | 一般现在时 | "This paper **presents** a novel approach..." |
| 描述具体做过的实验步骤 | 一般过去时 | "We **collected** 500 issues from GitHub and **manually labeled**..." |
| 描述实验结果（陈述客观发现） | 一般现在时 | "Table 3 **shows** that our approach **outperforms** the baseline." |
| 描述背景知识/领域共识 | 一般现在时 | "Static analysis tools **often produce** false positives." |
| 引用前人工作的具体做法 | 一般过去时 | "Smith et al. [12] **proposed** a graph-based technique." |
| 引用前人工作得出的普遍结论 | 一般现在时（也可过去时，视强调点） | "Prior studies **show** that code smells correlate with defects." |
| 展望未来工作 | will / 情态动词 | "We **plan to** extend this work to..." |

摘要（Abstract）整体倾向**现在时**（描述"这篇论文做了什么"用现在时，"做实验的过程"可用过去时）。

### 2. 语态（主动 vs 被动）

现代 CS/SE 论文（尤其顶会）**明显偏向主动语态**，因为更清晰、更短、责任主体明确：

- 弱：`The tool was evaluated on 10 projects.`
- 强：`We evaluated the tool on 10 projects.`

"We" 在 CS/SE 论文中是标准用法（即使单作者也常用 "we" 指代作者与读者的共同推理过程），不必回避。被动语态仅在**动作执行者不重要或众所周知**时使用，例如描述通用流程：`The source code is compiled into bytecode.`

避免过度使用 "It is worth noting that..." "It can be seen that..." 这类空洞的 it-引导句，直接给出主语。

### 3. Hedging（限定语／留有余地的表达）——学术严谨性的核心

不能把所有结论都写成绝对真理，也不能过度谦虚到没有贡献。关键动词/短语分强度使用：

- **强断言**（有充分证据支撑时）：demonstrate, show, confirm
- **中等断言**（常规结论）：suggest, indicate, imply
- **弱断言/推测**（超出数据直接支持范围）：may, might, could, appear to, tend to, is likely to

反例（过度绝对，容易被审稿人抓住）：
> "Our approach solves the problem of false positives completely."

改进：
> "Our approach substantially reduces false positives compared to existing tools, though it does not eliminate them entirely."

同样，限定短语如 "to the best of our knowledge"（用于新颖性声明）、"in our experiments"（限定结论适用范围）、"under the studied settings" 都是标配，能让 claim 更站得住脚，而不是显得不自信。

### 4. 术语一致性（Terminology Consistency）

- 一旦在 Introduction 中定义了一个术语（如 "code smell detector"），全文用同一词，不要后文换成 "smell identifier" "detection tool" 等同义替换——这在文学写作里叫变化多样，在学术写作里叫**歧义**，审稿人会怀疑是不是指两个不同的东西。
- 缩写第一次出现必须全称+括号缩写：`Abstract Syntax Tree (AST)`，之后全文只用缩写。
- 图表、章节的引用措辞要统一：全文只用 "Section 3" 或只用 "Sec. 3"，不要混用；"Table 2" 不要有时写 "the table below"。

### 5. 冠词、单复数（中国作者高频错误）

- 可数名词单数前几乎总需要冠词：~~"We propose approach"~~ → "We propose **an** approach" / "**the** approach"。
- 不可数抽象名词（research, work, information, feedback, literature）不加不定冠词、不加复数：~~"a researches"~~，~~"researches show"~~ → "research shows"。
- 主谓一致注意集合名词：`The results show`（复数）vs `The dataset consists of`（单数，dataset 是单数名词）。

### 6. 连接与信息结构

- 段落**首句是主题句**（topic sentence），概括本段论点；不要把结论藏在段尾才揭晓（这是中文议论文常见的"先叙述后总结"结构，学术英语要反过来）。
- 使用清晰的过渡词但不要堆砌：However / In contrast / Furthermore / Nevertheless / As a result / Consequently，每段一两个即可，不要每句都用。
- 遵循 **Given-New** 原则：句子开头承接上文已知信息，句尾引入新信息，避免读者跳读。
- 避免长难句套娃从句；一句话表达一个核心命题为宜，必要时拆成两句。

### 7. 避免的口水词/弱表达

| 避免 | 替换为 |
|---|---|
| a lot of / lots of | considerable, a substantial number of, numerous |
| very / really / extremely important | critical, essential, significant（视语境，避免堆叠副词） |
| big / huge problem | significant / substantial challenge |
| things, stuff | factors, aspects, elements（具体化） |
| get / got | obtain, acquire, derive |
| show up | emerge, appear |
| in order to | to（更简洁；in order to 并不错但能省则省） |
| due to the fact that | because |
| a large number of studies have researched | numerous studies have investigated |

---

## 三、段落与篇章层面

1. **摘要 (Abstract)**：通常遵循 背景/动机 → 现有方法的不足 (gap) → 本文方法 → 实验设置 → 关键结果（带数字）→ 意义/展望，5-8 句，不引用文献，不用缩写除非极常见。
2. **Introduction**：漏斗结构——从宽泛背景收窄到具体问题，明确 **motivation → gap → contribution list**（通常以 "In this paper, we make the following contributions:" 后跟 bullet points 结尾）。
3. **Related Work**：按主题/方法分类组织（不是按发表时间罗列），且要明确指出本文与已有工作的差异，避免"文献综述式罗列"（"A did X. B did Y. C did Z."）而不做比较。
4. **Threats to Validity**：CS/SE 论文的固定小节，分 internal / external / construct validity 讨论局限性，措辞要坦诚但不自我否定，例如："A threat to external validity is that our dataset is limited to Java projects; the findings may not generalize to other languages."
5. **Conclusion**：不是摘要的复述，应包含 takeaway + 对未来工作的展望，避免引入新的实验结果。

---

## 四、常见中式英语陷阱（简要，详见 references/chinglish-pitfalls.md）

- 主语堆叠范畴词："the problem of low accuracy" 优于 "the low accuracy problem"，但更好是直接 "low accuracy"。
- 过度使用 "with the development/rapid growth of X, ..." 作为开头套话——审稿人视为陈词滥调，建议直接切入问题。
- 中文里常见的"越来越多的" → 避免逐字 "more and more"，学术写作用 "an increasing number of" / "increasingly"。
- 避免不必要的第一人称情感表达："We believe our method is very useful" → 用数据说话，或改为 "Our results suggest that the proposed method is effective for..."。

---

## 五、Agent 工作方式建议

当用户提供一段草稿要求润色/翻译/改写时：

1. **先判断这段属于论文的哪一部分**（Abstract/Intro/Method/Eval/...），因为时态和句式规范因部分而异（见上表和 phrasebank）。
2. 逐句检查：时态是否匹配语境、claim 强度是否有 hedging 支撑、术语是否前后一致、是否有中式英语直译痕迹。
3. 输出时给出**修改后全文**，而不仅是罗列问题；如果改动较大，可以简要说明改了什么（例如"将过度绝对的表述改为 hedged claim"），但不要逐句写长篇批注打断阅读流。
4. 如果用户要求"检查语法"而不是"重写"，保持改动最小化，优先修正硬伤（时态错误、冠词缺失、主谓不一致），不要为了"更好"而大幅改写用户的行文风格。
5. 涉及具体数字/实验结果的句子，不要在没有依据的情况下擅自加强或减弱 claim 的强度——只调整表达方式，不改变事实断言的范围。
