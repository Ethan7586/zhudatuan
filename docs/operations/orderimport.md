# 外部订单导入运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

外部订单预检/执行停滞、来源单号重复、Mall/Member 映射、金额或支付证据不一致时触发。无资金证明订单进入“待核验”，不得履约、开票或结算；伪造已支付、重复履约、跨 Scope 或金额污染为 P0。

## Owner 与前置权限

Order Owner 主责，Payment、Finance、Fulfillment、Runtime 与 Security 协同。统一文件、任务、Checkpoint、取消与重试只遵循 `import.md`，本手册不复制其技术步骤。发起人必须有目标 Mall/来源权限和可验证的外部订单证据。

## 只读诊断（Diagnosis）

核对 `source + externalOrderNo` 业务唯一键，Mall/Member/Listing 映射，`orderedAt/state/currency`，行项目 `quantity/unitMinor/discountMinor/totalMinor` 守恒，以及 `paymentReference/statementReference` 与同 Scope、币种、金额的已捕获 Payment/已平 Statement。退款状态必须有后续退款证据；检查导入任务证据但不重复通用 Runtime 排查。

## 止血（Stop loss）

隔离受影响来源/账期，阻断待核验订单的支付完成、发货、收货、售后、退款、开票和结算；保留合法线上订单。禁止直接改订单状态、金额、支付引用或去重键。

## 恢复（Recovery）

Runtime 按 `import.md` 从 Checkpoint 恢复。相同来源单号只回读同一订单；资金证据暂缺保持待核验，由 Payment Query/Finance Reconciliation 补齐后通过领域 Operation 推进。永久映射/金额错误修正源文件后建新任务。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 证明来源键唯一、行金额之和等于订单应付、CNY 与证据一致、资金不伪造、履约/退款不重复、Scope 越界为 0，并与 Runtime 计数/Hash 对齐。Data repair 只用 Order/Payment/Finance 前向 Operation；Escalation 对资金或越权 P0；Audit 记录证据引用而非敏感正文。

## 回滚边界

待核验导入可通过订单规则取消/归档；已支付、履约、退款事实不能删除，只能售后、退款或冲正。技术任务边界见 `import.md`。

## 沟通模板

“订单导入 `{importId}`，来源 `{source}`，账期 `{period}`，成功/待核验/失败 `{accepted}/{pending}/{failed}`，资金/履约影响 `{impact}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

统一 Import 条件通过；订单唯一和金额守恒；所有已支付/履约声明有可追溯证据；待核验项有 Owner；跨 Scope、重复订单/履约为 0。

## 复盘链接（Postmortem）

伪造资金、重复履约、跨 Scope、金额漂移或来源契约失效必须填写 `{postmortemUrl}`。
