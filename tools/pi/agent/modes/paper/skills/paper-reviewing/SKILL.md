---
name: paper-reviewing
description: 全面、严谨的学术论文多维度系统化审稿（Peer Review）Skill。通过编排专职 Subagent 针对知识边界与创新增量、前后数据与符号一致性、反直觉发现与论证严密性、事实与引用准确性进行分步审查，输出高质量结构化审稿意见。
---

# 学术论文多维度系统化审稿 (Academic Paper Peer Reviewing)

本 Skill 沉淀了一套严谨、全面的计算机/软件工程顶级会议与期刊（如 ICSE, FSE, ASE, ICLR, ACL, TSE 等）标准的 Peer Review 工作流。
通过将审查任务分解到不同的专职 Subagent，分步深入审查论文的创新性边界、逻辑一致性、反直觉论证以及事实引用。

---

## 核心审稿流程架构

审稿流程分为 **4 个专门阶段（Phases）**，由主 Agent 协调分步派生专职 Subagent（或执行多阶段流水线）：

```
┌─────────────────────────────────────────────────────────────┐
│                       主 Agent 审稿调度器                    │
└──────┬──────────────┬──────────────┬──────────────┬─────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
 ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
 │ Subagent 1│  │ Subagent 2│  │ Subagent 3│  │ Subagent 4│
 │ 知识边界  │  │ 一致性与  │  │ 反直觉与  │  │ 事实与    │
 │ 与创新增量│  │ 形式化    │  │ 论证严密性│  │ 引用规范  │
 └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
       │              │              │              │
       └──────────────┴──────┬───────┴──────────────┘
                             ▼
                 ┌───────────────────────┐
                 │  综合 Peer Review 报告 │
                 └───────────────────────┘
```

---

## 分步审查维度与 Subagent 任务定义

### 阶段一：知识边界与创新增量审查 (Novelty & Knowledge Frontier)
* **目标定位**：站在学术界已知的知识边界上审视文章的创新立意与增量价值。
* **Subagent 任务核心清单**：
  1. **已有知识边界（Existing Frontier）**：论文所在领域的经典理论、基石性共识以及现有最新工作（SOTA）的边界分别是什么？
  2. **解决的增量问题（Incremental Delta）**：本文不是老调重弹，它在哪些具体切入点上完成了范式跃迁（如从“黑盒胜负”到“白盒机制”、从“经验套用”到“理论解构与证伪”）？
  3. **学科反哺价值（Disciplinary Impact）**：结论是否能对原有学科理论（如软件工程过程理论）或技术社区（如 Multi-Agent 系统设计）形成反哺或纠偏？

---

### 阶段二：前后一致性与形式化审查 (Consistency & Mathematical Rigor)
* **目标定位**：排查文稿是否存在“自我矛盾（Self-contradiction）”、“数据打架”及“符号体系定义不合规”。
* **Subagent 任务核心清单**：
  1. **跨章节数据交叉核验（Numerical Cross-Verification）**：
     * 核对 Abstract, Introduction, Results, Discussion, Conclusion 及 Tables 中的每一个数值（Pass@1、倍数、Gini、Rewrite Rate、动作熵、$\chi^2$、$\beta$、p值）；
     * 检查正文描述的胜负局数（Wins/Losses）是否与表格中的 Delta 符号与数值大小严格自洽。
  2. **形式化符号体系与公理闭环（Formal Axioms & Syntax）**：
     * 集合划分（如 $P_{\text{core}}, P_{\text{enh}}, P_{\text{coord}}$ 与 $C_{\text{lin}}, C_{\text{iter}}, C_{\text{cond}}$）在各模型实例化中是否符合标准集合论语法（严禁 $\subset, \subseteq$ 与 $\cup$ 的非法连缀）；
     * 有效性公理（Well-Formedness Criteria，如生产可行性、可达性、有界收敛性）是否自洽。
  3. **统计口径一致性**：
     * 明确区分全模型检验（Omnibus Test，如全模型 LR $p$ 值）与单项实践交互项检验（Wald $p$ 值），防止将全模型显著性张冠李戴到单项实践上。
  4. **历史大纲残留排查**：
     * 检查是否存在已废弃的研究问题（如 RQ4）、旧假设编号（如 H3a-H3d）、已删除的分析方法（如中介分析）或 `% FIXME` 开发注记残留。

---

### 阶段三：反直觉发现与论证严密性审查 (Counter-Intuitive Findings & Justification)
* **目标定位**：模拟挑剔审稿人（Skeptical Reviewer），对论文中所有反常识、反直觉或颠覆性结论进行“攻击预演”，检查因果解释链条是否牢固。
* **Subagent 任务核心清单**：
  1. **构念效度与联合证据链（Construct Validity Defense）**：
     * 审视评价指标是否存在构念错配（如“设计阶段不产代码”不等于“设计无用”）；
     * 确保使用**联合诊断准则**（如：高 Gini + 返工未减 + 正确率暴跌 三位一体判定“装饰性开销”）。
  2. **微观因果解释链（Micro-Causal Traces）**：
     * 检查核心失效现象（如 TDD 95% 重写率）是否给出清晰的微观错误级联路径（Error Cascading Path）；
     * 排除工具实现假象（如确认文件是增量编辑 Patch 而非全量覆写统计伪影）。
  3. **主效应 vs. 调节效应的声称力度（Claim Calibration）**：
     * 若某项基准由于样本量限制导致成对主效应统计不显著（如 SWE-Bench 上的 TDD），坚决不能声称“证明有效（proves effective）”，必须严谨降级为“正向实证趋势（positive empirical trend）”，并将统计显著性归于跨任务层级的“调节交互效应（interaction effect）”。
  4. **工程摩擦 vs. 理论本征（Delegation Tax / Attention Degradation）**：
     * 区分表层工程摩擦（格式解析可修复）与深层注意力衰减（LLM 上下文稀释），避免将工程 Bug 强行升格为理论概念。
  5. **环境支配效应（Environment Dominance）**：
     * 对复杂物理环境下动作熵趋同、角色 Prompt 异化的现象进行深入理论提炼。

---

### 阶段四：事实性、实验配置与引用规范审查 (Factual & Reference Rigor)
* **目标定位**：核实实验硬件/模型配置、基准数据集规模与经典文献引用元数据。
* **Subagent 任务核心清单**：
  1. **实验配置真实性**：
     * 模型全称（如是否带 `-Preview` 等确切后缀）、上下文窗口容量（如 1M）、采样温度（明确是否为平台默认无显式 override）及随机种子。
  2. **数据集抽样说明**：
     * 基准数据集若使用了子集（如 SWE-Bench Verified 500 题中抽取 96 题），必须在正文显式声明抽样规模与随机性。
  3. **参考文献元数据（BibTeX）核验**：
     * 重点核查基准论文与经典文献（如 ClassEval 对应 ICSE 2024 论文，经典 TDD 对应 Erdogmus TSE 2005 论文等），防止年份、作者或标题出现虚假/笔误信息。

---

## 报告输出规范模板

```markdown
# 学术评审报告（Peer Review Report）

## 一、 知识边界与创新增量评估 (Novelty & Boundary Positioning)
- 人类已知的知识边界
- 本文解决的不一样的增量问题
- 总体学术推荐意见

## 二、 核心主张与动机评价 (Motivation & Thesis)
- 核心立论优势
- 构念效度与语境界定

## 三、 形式化体系与一致性核验 (Formalization & Consistency Audit)
- 符号与公式严谨性
- 跨章节数据一致性排查表

## 四、 反直觉发现与论证严密性评价 (Counter-Intuitive Findings & Defense)
- 传统 SE 假设颠覆的证据链
- 任务权变与极性反转归因
- 审稿人潜在质疑与防御建议

## 五、 事实核查与引用排查 (Factual & Reference Audit)
- 实验配置与抽样声明
- 参考文献条目校正

## 六、 综合修复清单 (Actionable Revision Checklist)
- [P0 致命缺陷] ...
- [P1 严重问题] ...
- [P2 表述与规范] ...
```
