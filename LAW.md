# LAW｜项目权威总开关

状态：`ACTIVE`

本文件是项目内部唯一的权威入口。它不规定技术如何实现，只决定谁有权制定标准、哪些标准有资格生效。

## 权威结构

```text
Ethan 当前明确决定
        ↓
LAW｜总开关与第一道权威闸门
        ↓
雍彻科技治理标准
        ↓
SFL 核心标准
├── SFL 安全与运行完整性标准
├── 主打团标准
└── 疆域标准
```

## 总开关条款

1. Ethan 在当前任务中的明确决定拥有最高项目权威。
2. LAW 决定哪些标准生效；未被 LAW 启用的标准和文档只能作为参考。
3. 默认放行：除 Ethan 当前明确决定或 LAW 已启用标准中的明确限制外，AI 不得自行增加确认、验证、审批、门禁或权限收窄。
4. LAW 承认存在必须经 Ethan 明确授权的有限操作类别，但具体清单只能由已启用的下级标准明确列出；AI 不得按风险想象自行扩张。
5. AI、测试、历史文档、旧会话、代码注释和验收报告不能自行创造或启用标准。
6. 每套标准只能管理自己的职责范围，不得越权。
7. 下级标准与上级规则冲突时，上级优先。
8. 修改 LAW、启用标准、停用标准或改变标准权威，必须来自 Ethan 的明确决定。
9. 测试和验收只能证明结果，不能反过来创造新的产品规则或工程门禁。
10. 任何强制工程规则必须说明它防止的真实损失；无法对应真实损失的内容只能是建议。
11. 具体分支数量、时间盒、文件行数、命名、A0—A3、部署工具和测试数量不得成为 LAW 永久条款。
12. 具体部署方式属于当前运行政策，不属于不可改变的最高法律。

## 状态定义

| 状态 | 含义 |
| --- | --- |
| `ACTIVE` | 已由 LAW 启用，在自身职责范围内具有现行权威 |
| `REFERENCE` | 可以参考，没有阻塞权 |
| `HISTORY` | 只用于追溯 |
| `CANDIDATE_DELETE` | 疑似可删除，等待后续物理清场 |
| `UNKNOWN` | 尚未判断，不得擅自执行或删除 |

## 有效标准登记区

| 标准 | 安装状态 | LAW 启用状态 |
| --- | --- | --- |
| [雍彻科技治理标准](05_docs_ziliao/docs_wendang/governance/standards/01-雍彻科技治理标准.md) | `YC-GOV 1.0.0` | `ACTIVE` |
| [SFL 核心标准](05_docs_ziliao/docs_wendang/governance/standards/02-SFL核心标准.md) | `SFL-CORE 2.2.0` | `ACTIVE` |
| [SFL 安全与运行完整性标准](05_docs_ziliao/docs_wendang/governance/standards/03-SFL安全与运行完整性标准.md) | `SFL-SRI 1.0.0` | `ACTIVE` |
| [主打团标准](05_docs_ziliao/docs_wendang/governance/standards/04-主打团标准.md) | `ZDT-BIZ 1.0.0` | `ACTIVE` |
| [疆域标准](05_docs_ziliao/docs_wendang/governance/standards/05-疆域标准.md) | `REALM-GOV 1.0.0` | `ACTIVE` |

旧标准、旧流程和历史资料的状态登记位于 `05_docs_ziliao/docs_wendang/governance/zdt-rule-rebuild/`。SFL 运行注册表与具体疆域骨架不在本登记区；它们保持 `REFERENCE`。标准登记本身不会改变 GitHub、脚本、数据库或生产控制面的实际行为。
