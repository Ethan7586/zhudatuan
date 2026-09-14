# AU-592｜筑大团 Purchase API 数据访问边界

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260828180000_zhudatuan_purchase_access.sql`（1,044 行）。
- 审阅方式：逐段人工审阅 Purchase session、权益余额/保留/消耗函数、sandbox qualification/welfare bootstrap、表级 column grant、RLS、触发器、outbox/job 与最终断言；交叉检查 Purchase API runtime、PurchaseBenefitGateway、Aliyun role provisioning 及迁移契约测试。未连接数据库、未执行迁移或资金写入。

## 审计结论

- **G0：保留。** 此文件是 Purchase API 唯一的数据库最小权限迁移，界定报价、库存、订单、内部权益支付、支付捕获、履约及异步事件的直接写入边界；删除或跳过会破坏 schema ledger 和后续运行时前置条件。
- [FACT][E-AU-592-001] `zhudatuanpurchaseapi` 是独立 NOINHERIT login role；`access.purchase_session_context` 要求该 direct session、storefront membership、active principal/profile/mall、未撤销未过期 session、credential/access version 一致，并从活跃 phone OTP 证据重新计算 AAL2。
- [FACT][E-AU-592-002] `benefit.purchase_available` 验证账户集合非空、去重、上限和同会员/同商城/CNY/active 归属；`purchase_reserve` 对每个账户加锁、拒绝已有订单并创建 30 分钟 hold；`purchase_consume` 需要 AAL2、匹配 created order/intent、全 benefit tender、同额 held reservation，再逐 lot 加锁消耗并通过 security-definer `finance.post` 记账。Commerce 的 `PurchaseBenefitGateway` 是仓内实际调用者。
- [FACT][E-AU-592-003] Purchase role 只能按精确列更新 canonical lifecycle，不能获得任意表级 UPDATE/DELETE、finance/voucher schema usage、provider/refund/recovery/deadletter 表权限或 direct finance posting function；最终断言逐表、逐 column 反证这些边界。
- [FACT][E-AU-592-004] RLS 将 order/quote/intent/payment/fulfillment 限定到 request GUC 所代表的 storefront member+mall；支付仅容许 internal benefit tender/capture、订单行和履约均拒绝 provider/partner/store 数据，outbox/job 仅允许指定 lifecycle event/kind。
- [FACT][E-AU-592-005] sandbox qualification 与 welfare bootstrap 都要求独立数据库 sentinel、专用 bootstrap role、明确 membership 和固定 sandbox 语义，并写入 audit hash chain；不自动赠送、无生产数据、无后续 update/delete 权限是其契约的一部分。
- [FACT][E-AU-592-006] 现行 `PurchaseApiRuntime` 已要求后续 schema head 与双参数会话解析及更多受控函数；本 migration 的单参数 `identity.resolve_session` grant 属于正式后续迁移替代的历史契约，不能当作未引用函数删除。

## 未验证项

- 未验证真实 RDS 中 session GUC 写入原子性、AAL2 evidence、reservation expiration、lot 并发锁、finance post 原子性、payment capture 与 outbox/job 实际投递结果。
- 未执行数据库迁移、权益 reserve/consume、rollback、sandbox bootstrap 或 RLS allow/deny；线上是否已存在历史状态不符合该迁移断言的数据未知。
- 对资金/库存并发的行为测试与外部支付提供方调用已在其它专项记录，不在本 migration 单元中扩展修复结论。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；任何改动该边界的后续独立修复必须以隔离 PostgreSQL 覆盖跨会员/跨商城/RLS deny、重复 reserve、AAL1/AAL2、并发 lot、过期 hold、支付失败与事务回滚。
