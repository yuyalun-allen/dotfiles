# 中式英语（Chinglish）常见陷阱

供 agent 在润色中国作者英文初稿时系统性排查。每条给出典型错误模式 → 问题 → 修改方向。

## 1. 逐字直译的套话开头

- ✗ "With the rapid development of the Internet, more and more people..."
- 问题：审稿人熟知的"作文式"开头，在 CS/SE 论文中显得空泛、缺乏具体信息量。
- ✓ 直接切入具体问题："Modern software systems increasingly rely on third-party libraries, which introduces new security risks."

## 2. "越来越多" 的翻译

- ✗ "more and more researchers"
- ✓ "an increasing number of researchers" / "increasingly, researchers..."

## 3. 范畴词冗余（Category noun redundancy）

中文习惯给抽象概念加"...问题/...现象/...情况"，直译后显得啰嗦：
- ✗ "the problem of low efficiency of the algorithm"
- ✓ "the algorithm's low efficiency" 或更简："the algorithm is inefficient"
- ✗ "in the process of code review"
- ✓ "during code review"

## 4. 主语选择：过度使用 "we/people/researchers" 泛主语

中文常用无主句或泛指主语，英文学术写作倾向具体、明确的主语：
- ✗ "People think static analysis is useful."
- ✓ "Static analysis is widely regarded as useful." 或 "Prior work has shown that static analysis is useful [X]."

## 5. 连接词误用或缺失

中文靠语序/意合表达逻辑关系，英文必须显式连接：
- ✗ "The tool has high precision, it has low recall." （逗号拼接两个独立句，comma splice）
- ✓ "The tool has high precision but low recall." / "Although the tool achieves high precision, its recall remains low."

## 6. 强行凑长句 / 过度使用 "which" 从句堆叠

- ✗ "We propose a method which uses a graph structure which represents the code which is then analyzed by a neural network which..."
- ✓ 拆句，或用名词化结构："We propose a graph-based method that represents code as a graph and analyzes it using a neural network."

## 7. 情感/主观评价词过多

- ✗ "Our method is very powerful and can perfectly solve this important problem."
- ✓ "Our method effectively addresses this problem, achieving [具体数字] improvement over baselines."
- 原则：**用数据代替形容词**。学术写作里 "powerful" "perfect" "amazing" 几乎不该出现。

## 8. 不定冠词/定冠词遗漏或误加

- ✗ "We use deep learning model to detect bug." （缺冠词 + 单复数错误）
- ✓ "We use a deep learning model to detect bugs."
- 规则提示：可数名词单数几乎总要有限定词（a/an/the/this/our/...）；抽象不可数名词（research, information, work）不加 a/an。

## 9. 时态混用不一致（同一段落内随意切换）

- ✗ "We collect 500 samples. We evaluate our tool and it shows good performance."（过去时和现在时混杂且无逻辑）
- ✓ 明确按功能分工："We collected 500 samples and evaluated our tool on this dataset. The results show that..."（过程用过去时，客观结果陈述用现在时）

## 10. "根据...研究表明" 的直译

- ✗ "According to research, X shows..."（含糊，未指明具体来源）
- ✓ 明确引用："Prior studies [12], [15] show that X..." 或 "As reported by Smith et al. [12], X..."

## 11. "首先...其次...最后..." 列举时结构不平行

- ✗ "First, we collect data. Second, filtering the noise. Third, model was trained."（时态/语态/词性不统一）
- ✓ 保持并列结构一致："First, we collect data. Second, we filter noisy samples. Third, we train the model."

## 12. 过度谦虚或过度自信的两极化表达

- 过度谦虚：✗ "Our method may perhaps possibly help in some cases."（多重 hedge 叠加，显得没有信心，审稿人会质疑贡献）
- 过度自信：✗ "Our method always achieves the best results in all scenarios."
- ✓ 恰当 hedge："Our method consistently outperforms the baselines across the studied benchmarks, though its advantage narrows on [specific case]."

## 13. 标点与格式细节

- 英文学术写作中文列举不用中文顿号"、"，用逗号或分号。
- 缩写句号后接大写字母开头新句；避免中文全角标点（，。（）——很多中国作者初稿中残留全角符号）混入英文正文。
- 书名号《》不用于英文，论文标题用斜体或引号视投稿模板要求。

## 14. "导致/使得" 的过度使用 "make/cause/lead to"

中文"使得"泛化能力强，直译容易造成动词单一：
- ✗ "This makes the accuracy increase." / "This causes the performance become better."
- ✓ 用更精确的学术动词："This improves accuracy." / "This leads to a substantial improvement in performance." / "This results in higher accuracy."
