# AU-679｜Web Order Four-flow Read ACL

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260911153500_allow_web_order_four_flow_read.sql`（6 行）。
- 审阅方式：深入审阅。该文件虽短且属于 ACL 同构迁移，但直接改变 Web Business API 的 Payment/Finance 读取边界，故反向核对 `WebOrderOperations` 的实际查询、既有 role-boundary assertion、RLS 启用点与策略注册；未重复深读订单状态机，未执行迁移或连接运行数据库。

## 审计结论

- **G0：保留。** 此 migration 是 Web 订单读模型读取支付和财务事实的明确运行前置，不能按重复授权文件处理或删除。
- [FACT][E-AU-679-001] `WebOrderOperations.ts:57-76` 对已授权订单关联读取 `payment.intent/payment.payment/payment.allocation/payment.refund` 以及 `finance.journal/finance.entry`，用以构造订单 payment/finance facts；该 migration 是唯一向 `zhudatuanwebapi` 授予两个 schema `USAGE` 和表 `SELECT` 的后续迁移。
- [FACT][E-AU-679-002] migration 对两个 schema 当时全部 relation 授予 `SELECT`，而运行查询只使用前述六张表；早期 Web access assertion 曾明确禁止该 role 的 payment/finance schema access 和核心账务读取，显示此处是一次未同步收敛的边界变更。
- [FACT][E-AU-679-003] 所涉 payment/finance relation 已启用 RLS；迁移集中不存在面向 `zhudatuanwebapi` 的 `payment.intent/payment/payment.allocation/payment.refund` 或 `finance.journal/finance.entry` SELECT policy。现有相应策略分别只授权 `zhudatuanpurchaseapi`、`zhudatuanpaymentwebhookapi`、`zhudatuanidentityapi` 或 `shopapp`。
- **F-0277：P2。** PostgreSQL 的 table grant 不能替代 RLS policy；以 `zhudatuanwebapi` 运行时，四流 lateral subquery 会被 RLS 隐藏为无行（或在环境 ACL/RLS 漂移时表现不同），从而订单响应缺少其设计承诺的支付/财务事实。现有 TypeScript test 仅 mock query 并检查 SQL 文本，未执行 role/RLS contract。

## 未验证项

- 未取得已部署数据库的 role attributes、RLS policy catalog 或实际请求回执；上述结论基于完整 migration 链与 PostgreSQL RLS 语义，需在隔离数据库以正式 role 复核。
- 未确认 Web API 是否以 wrapper role、`SET ROLE` 或数据库 owner 身份连接；若存在，将改变实际 RLS 结果，应在独立复核中确认。

## 结论等级

- 新增问题：F-0277（P2，高置信度，需要独立复核）。无 P0。
- 垃圾代码：G0 1 项（Web order four-flow read ACL）；不新增 G1/G2/G3/GX。
- 二次复核：是；需重新核对 Web API 连接 role、RLS policy catalog 与真实订单四流响应。
