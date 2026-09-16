# AU-487｜财务对账完整性迁移深审

- 审阅对象：`02_platform_pingtai/database/supabase/migrations/20260828091000_finance_reconciliation_integrity.sql`（91 行）。
- 方法与证据：人工逐段阅读迁移及其前序生命周期 schema；静态追溯 `ReconcileStatement`、`ReconciliationJobProcessor`、`app/jobs.ts` 和对账读取操作。未执行迁移、Worker、对象存储或线上数据库。

## 真实链路与边界

`runtime.job(kind=reconciliation)` → `app/jobs.ts` 注册的 `ReconciliationJobProcessor` → `ReconcileStatement.execute` → `channel.statement`/对象存储 CSV 哈希校验 → `finance.statementline`、`finance.reconciliationitem`、`finance.reconciliation` → 差异时写 `runtime.outbox(finance.reconciliation.difference)`；控制台读取另经 `finance.reconciliations.read` 的 scope 过滤。

该迁移把既有对账模型收紧为 payment/refund 两种外部流水：在执行前拒绝旧 kind 和重复内部事实；以唯一约束、金额安全范围、`difference=debit-credit`、来源行/内部事实约束和 matched 条件保护父子记录。触发器把对账的 scope、provider、partner、期间和 hash 绑定到 `channel.statement`。它同时把每个 item 的 `kind` 反填到 evidence，并写入 schema ledger。

## 评审结论

- **GX-0012（扩展）**：这是资金对账、事实表和渠道账单绑定的持久化边界，禁止删除、单独重放或与功能调整混合。`ReconcileStatement.validate` 当前只接受 `payment`/`refund`，与迁移后的数据库检查一致；源码里仍留有 `fulfillment` 候选 SQL 分支，但输入验证和数据库约束均令该分支在此运行链不可达。它是否应在后续源码专项中收敛尚未验证，不能据此认定迁移或代码无用。
- 未发现新增 P0–P3。迁移以异常中止不兼容历史数据，不能由本次静态审计确认每个环境的历史数据、schema ledger、备份和恢复演练均已通过。

## 数据、权限与验证

- 数据所有权：`finance.reconciliation`、`finance.statementline`、`finance.reconciliationitem`；外部账单权威记录为 `channel.statement`。
- 契约：账单 hash/范围/提供商/合作方/期间必须一致；相同内部事实不得在同一 reconciliation/kind 下重复；matched 必须零差异且无原因码。
- 权限：本迁移不授予调用权限；读取层采用 `access.scope_allowed` 和组织闭包。RLS/grant 与真实数据库状态留给 GX-0012 独立复核。
- 未验证：迁移执行 ledger、存量数据是否满足新约束、对象存储 CSV、队列投递/重试/死信、差异事件消费者及生产恢复路径。
