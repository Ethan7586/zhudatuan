# AU-490｜支付提供方时间证据迁移深审

- 审阅对象：`02_platform_pingtai/database/supabase/migrations/20260828095000_payment_provider_time_evidence.sql`（133 行）。
- 方法：人工逐段审阅列/约束/不可变触发器和 schema 断言；静态追溯 Payment Gateway、PaymentJobs、PaymentJobSupport、PaymentSettlement、退款观察与 job 注册。未执行迁移、支付网关、队列、测试或线上查询。

## 真实运行关系

`paymentquery`/`paymentrefund` Job（分别有 16/8 并发、30 秒 timeout、重试/租约/死信）调用经过场景哈希约束的 Payment Gateway。成功支付与退款将 provider authoritative RFC3339 instant、canonical effect JSON 和 hash 在同一事务写到 attempt/capture/providerattempt；支付成功再进入 settlement、订单/outbox，退款观察需先得到不冲突的权威 effect。查询/关闭观察单独落 `payment.observation`。

迁移约束把 `completed_at` 与 provider instant 对齐、验证 provider/kind/业务 id/金额/币种/时间和 JSON digest；effect 一旦存在，触发器禁止修改或删除。历史行可保持三个证据字段均为 null，故迁移并不伪造旧时间证据。

## 评审结论

- **G0**：这是实际支付/退款 Worker 和财务对账修复链的证据契约，不属于删除候选。它归入既有 **GX-0021**（支付应用场景隔离）及支付/财务独立复核范围。
- 未发现本迁移新增且可直接证实的 P0–P3。当前约束与 Job 写入字段一致；Payment Gateway 的 `providerOccurredAt` 对时间格式、日历与 offset 做严格校验。
- 未验证：目标数据库的迁移 ledger/触发器/RLS，真实微信回执、对象化 evidence 尺寸、重试/死信、历史 null 证据数据及渠道端时间争议恢复。
