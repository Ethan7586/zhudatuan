# AU-680｜Web Order Route Facts Read ACL

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260911155000_allow_web_order_route_facts_read.sql`（6 行）。
- 审阅方式：结构性复核加差异深入检查。复用 AU-679 已确认的“table ACL 不等于 RLS access”规则，只核对本 migration 新增 schema 与 WebOrderOperations 的新增 relation 差异、既有 policy 及 RLS 注册；未重复审读订单四流主查询或已审状态机。

## 审计结论

- **G0：保留。** migration 为 Web order read model 读取 route、库存、履约子事实提供表级访问前提，不是可按同构授权文件删除的候选。
- [FACT][E-AU-680-001] Web order 查询除已有 `ordering.orderrecord/line/aftersale`、`inventory.reservation`、`fulfillment.fulfillmentorder` 外，还实际读取 `ordering.suborder/reviewaction`、`fulfillment.line/milestone`；这些 relation 用于 economic legs、履约明细/里程碑和售后审批记录。
- [FACT][E-AU-680-002] 初始 migration 对 ordering、inventory 与 fulfillment 表启用 RLS。既有 `zhudatuanwebapi` policy 仅覆盖 orderrecord、line、aftersale、reservation 和 fulfillmentorder；全迁移链不存在针对 suborder、reviewaction、fulfillment.line、fulfillment.milestone 的该 role SELECT policy。
- **F-0278：P2。** 该 migration 的 all-tables SELECT 虽消除了 table-ACL denied，却不能绕过 RLS；相关 nested route/fulfillment/operation facts 将被隐藏为空。它同时比运行所需范围宽，后续 policy/role 漂移时扩大读取面。

## 未验证项

- 未在隔离数据库获取 `pg_policies` 的最终态或以实际 Web connection role 执行 SQL；需与 F-0277 合并在同一个最小 ACL/RLS repair 设计中复核。

## 结论等级

- 新增问题：F-0278（P2，高置信度，需要独立复核）。无 P0。
- 垃圾代码：G0 1 项（Web order route facts read ACL）；不新增 G1/G2/G3/GX。
- 二次复核：是。
