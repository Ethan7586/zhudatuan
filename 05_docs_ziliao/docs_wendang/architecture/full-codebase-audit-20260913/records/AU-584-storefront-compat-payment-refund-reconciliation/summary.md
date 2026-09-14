# AU-584｜Storefront Compatibility 内部支付、退款与对账迁移

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260725014000_payment_refund_reconciliation.sql`（159 行）。
- 审阅方式：逐段人工审阅 payment/refund transaction、idempotency/lock、账本/分配/状态更新、reconciliation projection与 Commerce API caller；未执行资金 RPC 或数据库重放。

## 审计结论

- **G0**：这是 Compatibility 内部资金流和财务读取链路的核心迁移，不能删除。
- [FACT][E-AU-584-001] 内部支付对 `(mall, scope, idempotency key)` 取得 transaction-scoped advisory lock，锁定订单与账户、条件扣余额、创建 payment/allocation/ledger、更新订单/子订单、写幂等与 audit；任一异常回滚该 function DML。
- [FACT][E-AU-584-002] 退款锁定售后与订单，限制金额不超售后请求/已付减已退，仅处理 welfare/meal payment，并为每笔 allocation 回充账户、账本和 refund，再更新售后/订单/幂等/audit；普通角色无直接 execute。
- [FACT][E-AU-584-003] Commerce API 的 refund/reconciliation handlers先进行 authorization/resource scope/idempotency/input 检查，再调用 service-role RPC；对账返回 paid/payment/allocation/debit/refund/credit 不一致项，不写数据。
- [FACT][E-AU-584-004] Compatibility 与 Canonical 同名 migration SHA-256 一致；Canonical later授权/微信退款迁移存在不同终态，不能据其覆盖情况推断 Compatibility 生产状态。已有 F-0252 是 Commerce Finance domain 的独立 statement matching 风险，与本 RPC 的 order/payment/ledger projection 不是同一缺陷。

## 未验证项

- 未验证真实退款并发、超过已退金额、payment allocation/ledger一致性、advisory lock hash collision、失败回滚或远端 finance数据。
- 未核验 Compatibility 是否有后续 authorized wrapper、refund closure/ACL migration，或 service-role credentials 是否只由受信 Commerce API 使用；这些决定最终权限而非本初版单独可证明。
