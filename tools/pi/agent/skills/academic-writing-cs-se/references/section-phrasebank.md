# 分节学术表达短语库（CS/SE 论文）

按论文结构分类的常用句式框架。用于在撰写/润色对应章节时提供地道、符合规范的表达，而非逐字翻译中文原意。

---

## Abstract

开头（背景/动机）：
- "X has become a critical concern in software engineering due to..."
- "Despite recent advances in X, Y remains a significant challenge."

指出不足（gap）：
- "However, existing approaches suffer from / are limited by..."
- "Prior work largely overlooks / does not adequately address..."

引出方法：
- "In this paper, we propose/present X, a novel approach to..."
- "We introduce X, which leverages Y to address Z."

方法概述：
- "X works by first ... and then ..."
- "X combines A with B to achieve..."

实验/结果（用数字量化）：
- "We evaluate X on N real-world projects/datasets, comparing against M baselines."
- "Experimental results show that X outperforms the state-of-the-art by N%."
- "Our results demonstrate that X achieves an average improvement of N% in [metric]."

收尾（意义）：
- "These findings suggest that X can effectively help developers..."
- "Our work opens up new directions for..."

---

## Introduction

背景引入（避免陈词滥调开头，如需背景句可用）：
- "X plays a crucial role in modern software development."
- "As software systems grow increasingly complex, X has become essential."

问题陈述：
- "A key challenge in X is..."
- "Despite its importance, X remains under-explored."

现有方法及其局限（承上启下）：
- "Existing techniques for X can be broadly classified into A and B."
- "While these approaches have shown promise, they suffer from two major limitations."
- "First, ... Second, ..."（用于列举局限，保持并列结构一致）

引出本文工作：
- "To address these limitations, we propose X."
- "Motivated by this observation, we present..."

贡献列表引导句（几乎是固定搭配）：
- "In this paper, we make the following contributions:"
- "The main contributions of this work are summarized as follows:"

贡献条目常用动词：propose, design, implement, conduct, evaluate, release/open-source
- "We propose a novel technique that..."
- "We conduct an extensive empirical study on..."
- "We release our dataset and implementation to facilitate future research."

Introduction 结尾（论文结构导览，可选）：
- "The remainder of this paper is organized as follows. Section 2 reviews related work..."

---

## Related Work

分类组织的引导句：
- "Research related to our work can be divided into two categories: X and Y."
- "We discuss related work along two dimensions: A and B."

介绍已有工作（避免流水账式罗列，尽量归纳共性）：
- "A line of work has focused on..."
- "Several studies [1], [2], [3] have investigated..."
- "X et al. [12] proposed a technique that... Building on this, Y et al. [13] extended..."

指出与本文的区别（Related Work 最关键的部分，避免只描述不比较）：
- "Unlike these approaches, our work focuses on..."
- "In contrast to X, which relies on Y, our approach does not require..."
- "To the best of our knowledge, no prior work has addressed X in the context of Y."

---

## Approach / Methodology

总体介绍：
- "Figure 1 presents an overview of our approach, which consists of three main components: A, B, and C."
- "Our approach operates in two phases: (1) ... and (2) ..."

描述步骤（过程性描述常用现在时，强调"方法如何运作"是通用机制而非一次性事件）：
- "Given an input X, the first step is to..."
- "The algorithm iterates over... until..."
- "We then apply X to filter out..."

设计选择的合理性说明（这是论文说服力的关键，避免只说 what，不说 why）：
- "We choose X over Y because..."
- "This design is motivated by the observation that..."

形式化定义（如涉及）：
- "Formally, we define X as follows: ..."
- "Let G = (V, E) denote..."

---

## Experimental Setup

- "To evaluate the effectiveness of X, we conduct experiments to answer the following research questions (RQs):"
- "RQ1: How does X compare to state-of-the-art baselines in terms of...?"
- "We construct our dataset by collecting..."
- "We compare X against N baselines, including..."
- "All experiments are conducted on a machine with [specs]."

---

## Results / Evaluation（陈述客观发现，用现在时）

- "Table 3 shows that X achieves the highest [metric] across all datasets."
- "As shown in Figure 4, X consistently outperforms the baselines."
- "We observe that X performs particularly well when..."
- "Interestingly, X shows a notable improvement in cases where..."
- "This result confirms our hypothesis that..."
- "The improvement is statistically significant (p < 0.05, Wilcoxon signed-rank test)."

解释异常/负面结果时（诚实但不过度贬低自己的工作）：
- "One possible explanation for this result is..."
- "We attribute this to the fact that..."
- "This suggests a limitation of X in handling..."

---

## Discussion

- "Our findings have several implications for practitioners and researchers."
- "These results suggest that X can be a practical solution for..."
- "An interesting observation is that..."
- "This raises the question of whether..."

---

## Threats to Validity

固定小节结构，通常分三类：

Internal validity（实验设计/实现是否引入偏差）：
- "A threat to internal validity concerns potential errors in our implementation. To mitigate this, we..."

External validity（结论能否泛化）：
- "A threat to external validity is that our evaluation is limited to [language/domain]. The results may not generalize to..."
- "To mitigate this threat, we evaluate on a diverse set of N projects spanning..."

Construct validity（评价指标是否真正反映所研究的概念）：
- "A threat to construct validity concerns whether [metric] accurately reflects [concept]. We follow prior work [X] in adopting this metric to ensure comparability."

---

## Limitations（若单独成节，常见于期刊/近年会议）

- "Our approach has several limitations. First, ... Second, ..."
- "X currently does not support..., which we leave for future work."
- "The scalability of X on extremely large codebases remains to be evaluated."

---

## Conclusion

- "In this paper, we presented X, a novel approach to..."
- "Our extensive evaluation on N projects demonstrates that X significantly outperforms existing approaches in terms of..."
- "We believe X provides a promising direction for..."（可少量使用第一人称信念表达，但不宜作为核心论证依据）

未来工作：
- "As future work, we plan to extend X to support..."
- "An interesting direction for future research is to investigate..."

---

## 致谢 / 数据可用性（常见固定句式）

- "This work was supported by [grant]."
- "To facilitate reproducibility, we make our code and dataset publicly available at [URL]."
