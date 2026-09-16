# AU-693｜供应商分析视图与运营指标

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260912130000_create_supplier_analytics_perspective.sql`（254 行）。
- 审阅方式：深入审阅 supplier metrics/cockpit 的时间窗口、退款/结算/库存聚合、function ACL/RLS、Reporting/Web/Console 调用与已有测试；未重复逐行审阅 AU-692 已覆盖的同构供应商品种子。

## 审计结论

- **G0：保留。** migration 将供应商维度的商品、履约、结算、库存与订单事实组合为 `reporting.supplier_metric_rows` 和 supplier cockpit；实际由 Console cockpit、Web reporting、Identity/operator reporting 和 job runtime 调用，不能作为只读统计 SQL 删除。
- [FACT][E-AU-693-001] 所有仓内 HTTP/action callers 从认证 `access.scope.id` 传入当前 scope；supplier 参数由请求读取，但 function 进一步要求 supplier 属于该 scope 且 active。Web dashboard cache key 也含 scope、period 与 projection version，并在 supplier filter 存在时禁用缓存。
- [FACT][E-AU-693-002] 两个 supplier reporting function 同样是 `security definer` 与 `row_security=off`，并向 `shopapp`、`shopjob`、Identity API 与 Web API grant execute；这把更敏感的订单、退款、结算、库存和协议衍生事实纳入 AU-692 F-0282 所述“调用参数而非数据库会话 scope”边界，作为同一问题的扩展证据，不另行重复编号。
- **F-0283：P2。** supplier cockpit 标示的“供应成交额/净成交额”与 `netSalesRatio` 实际按订单行总额计算，未在当前或前一期 totals 中扣除已完成退款；同时 `refundedCents` 与 `refundRate` 汇总所有历史已完成退款，未限制到请求 period。另一 function 的 `sales.amount` 又对当前期间订单关联的所有 completed aftersale 扣款。相同 supplier/period 的两个运营入口因此具有不一致且跨期的净额/退款语义。

## 未验证项

- 未连接生产 PostgreSQL 或读取生产订单、aftersale/settlement 数据，未量化实际报表偏差；不把潜在历史退款偏差写成已发生财务损失。
- AU-692 的定向 test 会同时执行本 migration，但该正式入口在此 audit worktree 因 `vitest: command not found` 未启动；未安装依赖或修复环境。现有静态 test 仅覆盖 supplier happy-path sales/fulfillment/settlement，不含跨期退款或 runtime role/RLS deny matrix。

## 结论等级

- 新增问题：F-0283（P2，高置信度，需要独立复核）。无 P0。
- 关联问题：F-0282（P2，supplier projection function 的 database scope boundary）。
- 垃圾代码：G0 1 项（supplier metrics/cockpit projection）；不新增 G1/G2/G3/GX。
- 二次复核：是；复核者需独立确定“订单发生期”与“退款完成期”的业务口径，并用真实 PostgreSQL role/session、跨期退款 fixture 和两个入口的同一 period response复算。
