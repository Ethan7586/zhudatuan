# AU-623｜Payment Mall Identity

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260901220000_add_payment_mall_identity.sql`（213 行）。
- 审阅方式：逐段人工审阅 15 relation 的 mall backfill、orphan/conflict report、not-null/unique/FK/index 约束、webhook scope resolver 与 assertion；交叉检查 PaymentWebhook、PaymentDeadletter、payment read/write queries 和 mall identity tests。未连接数据库或执行迁移/测试。

## 审计结论

- **G0：保留。** 此 migration 将 mall identity 贯穿支付 intent、attempt/prepay、capture/allocation、refund/tender/command/provider attempt、effect、deadletter/recovery 全链路，是跨商城支付隔离与 webhook routing 的数据基础。
- [FACT][E-AU-623-001] backfill 从 order→intent→子表/支付→退款/恢复的 parent chain 推导 mall；报告每表 null 数与 cross-mall conflict，任一 orphan 或 conflict 使事务失败后才设 15 列 NOT NULL。
- [FACT][E-AU-623-002] composite unique keys 与 composite foreign keys 使 child `(mall_id,parent_id)` 必须匹配同一 mall parent；provider reference/event 和 recovery resource uniqueness 也调整为 mall-scoped。
- [FACT][E-AU-623-003] `payment.webhook_scope` 对 payment 要求 application hash 匹配且仅一个 distinct mall，对 refund 从 refund mall 获取；PaymentWebhook、PaymentDeadletter 和 payment port 当前 SQL 均带 mall predicates，tests 覆盖 mall insert/read/query composition。

## 未验证项

- 未在隔离数据库回放历史 payment rows、跨 mall FK/recovery conflict 或 webhook ambiguity；未验证真实 provider callback/重试场景的 mall routing。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；任何新 payment child relation 必须同批加入 mall backfill、not-null、parent composite FK、查询 predicate 与 webhook/recovery对账。
