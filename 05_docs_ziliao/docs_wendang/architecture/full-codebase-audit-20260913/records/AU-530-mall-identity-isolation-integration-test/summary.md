# AU-530｜Mall identity isolation PostgreSQL 测试

- 审阅范围：`01_core_hexin/services/commerce/tests/repository/MallIdentityIsolation.test.ts`（96 行）。
- 审阅方式：逐段人工阅读；测试需要 PostgreSQL endpoint，本轮未执行。

## 真实运行关系

同一 member、SKU、listing、idempotency/provider/external references 在两个 mall 建立独立 order/payment/recovery/fulfillment/return/inventory facts；读写查询始终附 mall_id/scope，并在单 transaction 的 finally rollback 清理。

## 审计结论

- **G0**：test 覆盖同一外部标识跨 mall 的数量/读取隔离，以及只更新 mall A recovery/return/reservation 不影响 mall B。它保存 Purchase、Payment、Fulfillment、Inventory 跨 mall 数据所有权契约，不是无效 duplicate fixture。
- 该测试直接使用数据库 client 并显式 predicates，不能证明 application role RLS/AccessPipeline 或所有生产 query 均具 scope 过滤；它是模型回归而非完整 authorization integration。

## 未验证项

- 未连接 test database；schema unique constraints、RLS/roles、并发和完整 API/Worker invocation 未验证。
