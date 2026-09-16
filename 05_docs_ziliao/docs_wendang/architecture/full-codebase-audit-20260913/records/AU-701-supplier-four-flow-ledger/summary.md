# AU-701｜供应商四流台账

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260912190000_create_supplier_four_flow_ledger.sql`（311 行）、`20260913021500_align_purchase_supplier_flow_access.sql`、PlaceOrder、Payment/Refund/Inventory/Fulfillment/Finance ports 与 supplier four-flow business contract。
- 审阅方式：深入审阅采购关系/合同/路由版本、下单快照、库存预留、履约责任、支付回执、退款分配、财务正反向事实、数据库 grant/RLS及业务契约。

## 审计结论

- **G0：保留。** 台账把供应链的关系/合同/路径版本冻结到 order line/suborder，并通过库存、履约、支付和财务事实保持四流可追溯。下单、支付、退款、退货和 journal workflow 都有真实写入者；不是重复 schema 或归档数据。
- [FACT][E-AU-701-001] `PlaceOrder` 在同一订单写链生成 route snapshot、line route steps、supplier legs、reservation facts 和 fulfillment responsibility；capture 把 reservation 改 committed并写 merchant receipt；refund replay 写 return/restock/reversal/allocation并保持幂等唯一键。
- [FACT][E-AU-701-002] `supplier_four_flow_business_contract.sql` 覆盖钱款守恒、正反向 route、历史快照不重算、四流事实完整、供应商隔离、部分退款、Realm membership 投影及注入失败回滚；它没有用正式 runtime role测试 RLS。
- **F-0284：P2。** `20260913021500` 向 `zhudatuanpurchaseapi` 直接授予 `catalog.supplyoffer`、四张 partner 关系/合同/路由表 SELECT，及三个 order/inventory/fulfillment 台账 INSERT；全 migration 链中未找到这些 relation 的 `ENABLE ROW LEVEL SECURITY` 或该 role 的 scope policy。Purchase API 的 query/action 当前以 Mall/order context过滤，但数据库自身没有对新增 relation执行跨 Mall/tenant defense-in-depth。

## 未验证项

- 未运行全量 database contract runner；当前 business contract证明业务数据关系，不证明真实 API role/RLS matrix。
- 未读取生产 `pg_class.relrowsecurity`、`pg_policies`、role inheritance或真实 Purchase connection context；未断言已有线上泄露。

## 结论等级

- 新增问题：F-0284（P2，高置信度，需要独立复核）。无 P0。
- 垃圾代码：G0 1 项（supplier four-flow ledger）；不新增 G1/G2/G3/GX。
- 二次复核：是；须在隔离 PostgreSQL用真实 `zhudatuanpurchaseapi`/无权限 role验证同 Mall allow、跨 Mall deny、table privilege最小化和 order transaction rollback。
