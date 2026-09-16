# AU-009 历史取证

历史只用于解释设计边界，不替代固定基线代码和运行反证。

| 提交 | 历史事实 | 本 AU 解释 |
| --- | --- | --- |
| `dd3eda9c` | 建立早期平台基线，Kernel 多数基础原语可追溯至此 | 不能因历史久远认定公共原语无用 |
| `fe3269c8` | 首批整合检查点并迁移到当前目录轴 | Kernel import 路径随目录整合继续被 72 个源码文件使用 |
| `45a6b1dc` | Payment 恢复提交触及部分 Kernel/支付关系 | 只作消费者历史，不替代当前代码 |
| `6931a130` | 明确新增统一门禁“空壳”及 GateEngine/tests | 支持 Gate 目前仅 disabled/observe，不应被解释成遗漏 enforce |
| `6b6af023` | 收口四个特殊目录 identity 与 Module manifests | manifest 是持续维护的架构描述，但提交没有接入 ModuleCatalog startup |
| `bae17625` | Notification 六层和 provider adapter 稳定点引入 `businesskeywrite` 消费 | WeChat 幂等键接缝需按当前 adapter 事实评估，不能只看 Kernel 模式名 |

[FACT][E-AU-009-013] 相关历史没有发现“ModuleCatalog 已成为生产启动器”或“businesskeywrite 由 Kernel 校验 idempotency key”的提交证据；这两项仍以当前代码为准。
