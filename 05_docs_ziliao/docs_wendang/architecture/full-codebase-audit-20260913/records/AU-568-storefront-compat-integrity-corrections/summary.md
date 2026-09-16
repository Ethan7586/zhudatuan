# AU-568｜Storefront Compatibility 订单支付完整性修正迁移

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260724072000_integrity_corrections.sql`（124 行）。
- 审阅方式：逐行人工审阅约束变更、内部支付 RPC、账本/支付 allocation 写入与授权；定向比对 Canonical 同名迁移、后续 payment/refund/read-model migrations 和调用入口。未执行数据库 replay。

## 审计结论

- **G0**：该迁移有明确数据完整性职责，不能删除。它将 `users(tenant_id, identity_subject)` 从 `UNIQUE NULLS NOT DISTINCT` 改为普通 `UNIQUE`，使一个租户中尚未绑定 identity subject 的多个成员可共存；并在内部支付成功路径为每笔渠道 payment 写入 `payment_allocations`，补齐 later order read model、admin payment split 与 finance reconciliation 的关联基础。
- [FACT][E-AU-568-001] `api_pay_internal` 在同一 PL/pgSQL transaction 内锁定订单和账户、余额条件扣减、创建 ledger/payment/allocation、更新订单/子订单、写 idempotency/audit；任一异常中止该 function 的写入。
- [FACT][E-AU-568-002] 此处的 `payment_allocations` 写入随后被 `20260725014000_payment_refund_reconciliation.sql` 重申，并被 `20260724101500_order_read_model.sql`、`20260810130000_admin_operations_real_write_path.sql` 读取；它承担真实读模型和财务对账契约。
- [FACT][E-AU-568-003] Compatibility 与 Canonical 同名迁移 SHA-256 完全相同；它们是隔离数据库各自需要按序 replay 的共同历史，不是可合并或可删除的重复品。
- 后续 migration 给 payment function 增加 advisory idempotency lock，并于 member-assurance 阶段改由 authorized wrapper 对外执行、撤销原始 service_role grant。因此本文件不是最终支付权限或并发实现的唯一权威。

## 未验证项

- 未在真实 Compatibility PostgreSQL replay/执行 RPC，未验证现有数据能否通过 unique-constraint 转换；固定基线只包含空/seed 历史，线上/远端 ledger 未读取。
- 未进行并发相同 idempotency key、余额竞争、失败回滚或跨租户数据隔离的运行反事实；这些由后续迁移和专项 contract tests继续覆盖。
- 本文件没有独立静态调用者，因为它由 migration ledger 顺序触发；该事实不构成垃圾代码候选。
