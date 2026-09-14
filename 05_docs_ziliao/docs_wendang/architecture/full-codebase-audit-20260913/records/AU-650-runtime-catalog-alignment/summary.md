# AU-650｜Publish Runtime Catalog Alignment

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260905010000_publish_runtime_catalog_alignment.sql`（68 行）。
- 审阅方式：逐段人工审阅 operation/capability/entitlement 的发布数据与 migration guards；反向追踪两个 operation 的实现、模块装配、Purchase API entrypoint 和 route contract test。未执行数据库或服务。

## 审计结论

- **G0：保留。** migration 以限定 database user、精确 predecessor 和 permission 前置条件发布两个 member operation，并将其 platform-root entitlement 设为 enabled。
- [FACT][E-AU-650-001] `payment.intents.read` 已被 Purchase API selected module、operation array 与 route test 一致装配；其 catalog path `/api/v1/payments/intents/{paymentid}` 有实际 route 证据。
- **F-0271（P2，新增）**：`order.orders.receive` 同时被 runtime catalog 发布为 `POST /api/v1/orders/{orderid}/receive`，却未被任一实际 API entrypoint 的 selected operation/module 装配；Purchase API 的明确闭包测试反而将其固定排除。因此已发布契约没有可达运行 route。
- [FACT][E-AU-650-002] receipt handler 本身只更新当前 scope member 的 shipped order，并使用 version optimistic lock；问题是调用入口断开，而非已发现越权写入。

## 未验证项

- 未在部署环境请求该 path；结论基于全部非测试 source 的 operation-id 调用检索、Purchase API entrypoint 与其明确 operation/route test。
- 未核验外部 API gateway 是否还存在未纳入本仓的动态路由层；仓内 Node service 采用 `bootstrapApi` 的 allowlisted operation array 注册 routes。

## 结论等级

- 新增问题：P2 1 项（F-0271）。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：否；修复前应复核产品是否仍承诺用户确认收货，若已下线应按正式契约退役而不是保留幽灵 catalog entry。
