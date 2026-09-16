# AU-627｜Enable Public Mall External Payment

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260902011000_enable_public_mall_external_payment.sql`（203 行）。
- 审阅方式：逐段人工审阅 predecessor guard、security-definer payment context、受限 recovery enqueue、Purchase role ACL/RLS、ledger assertion；交叉检查 ExternalPaymentIntentOperations、Purchase adapters/runtime guard 与 PublicMallCheckout 数据库契约。未连接数据库、发起支付或执行测试。

## 审计结论

- **G0：保留。** 此 migration 为 Public Mall 的 WeChat external tender 交付最小数据库权能：Purchase runtime 只能在其当前 membership/session/mall/order 上读取启动上下文、创建/更新受限 attempt/prepay，并经专用函数排队 payment query。
- [FACT][E-AU-627-001] migration 先锁定并要求精确 predecessor ledger、拒绝 future head；`purchase_payment_intent_context` 以 `session_user='zhudatuanpurchaseapi'`、active purchase session、order/member/mall、WeChat application hash 和锁定 intent/order 共同限定 identity ciphertext 的返回范围。
- [FACT][E-AU-627-002] `purchase_enqueue_payment_query` 仅接受两组 priority/delay，验证 purchase session/intention state 后按固定 `paymentquery/payment` job upsert；Purchase 无 `runtime.job` update 权限。
- [FACT][E-AU-627-003] attempt/prepay RLS 强制 WeChat provider、固定 tender、合法 state/application hash 及 `purchase_intent_allowed`；intent/order update policy 只允许 authorizing/captured 对应的受限状态迁移。
- [FACT][E-AU-627-004] ExternalPaymentIntentOperations 把 database transaction、request idempotency、provider call、unknown outcome recovery 和 mall-qualified writes 分开处理；PublicMallCheckout repository test 覆盖重复请求仅一次 prepay、attempt/prepay/job mall 归属与随后 payment capture 的可观察链。

## 未验证项

- 未在隔离 PostgreSQL 以实际 `zhudatuanpurchaseapi` 角色执行同 mall、跨 mall、失效 session、错误 application hash、重复 request 和 provider timeout 的反事实路径。
- 未调用真实 KMS/WeChat provider；未验证历史 database 是否恰好停在该 migration 的 strict predecessor。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；任何扩展 Purchase role 的 payment/RLS 权限必须重新按跨 mall、无 session 和 provider ambiguity 做独立复核。
