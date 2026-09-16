# AU-573｜Storefront Compatibility 测试目录隔离迁移

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260724234000_test_catalog_flag.sql`（137 行）。
- 审阅方式：逐段人工审阅 `is_test` 数据模型、catalog projection、拒绝下单 trigger 和 purge RPC；定向检索后续 catalog migrations、Canonical cutover contract 与同名迁移。未执行 SQL。

## 审计结论

- **G0**：该文件建立测试商品的识别、索引、下单隔离与清理契约，不能删除。
- [FACT][E-AU-573-001] `is_test` 默认为 false，目录 RPC 投影该标记；`trg_reject_test_product_order_item` 在 product 为 test 时拒绝 order_item insert/update，防止测试商品进入订单业务链路。
- [FACT][E-AU-573-002] `purge_test_catalog` 仅以 `is_test` 与指定 mall 为条件，按 cart-item → inventory → SKU → product 的依赖方向清理；仅 service_role 可执行。它不是普通应用 route 的可用功能，但保留测试环境清理/历史 replay责任。
- [FACT][E-AU-573-003] 后续 Compatibility catalog taxonomy/governance、checkout projection 与 mobile catalog migrations持续读取 `is_test`；Canonical database 的 later inventory single-source cutover 明确检测并删除旧 test-import/purge RPC，说明这一隔离机制属于演进链路，非未证实的垃圾代码。
- Compatibility 与 Canonical 同名 migration SHA-256 相同；迁移仅能在各自隔离数据库中按 ledger 顺序执行。

## 未验证项

- 未在实际数据上验证 purge 对历史 test order/FK 的失败模式、事务性和操作者授权；测试商品理论上由 trigger 阻止进入新 order item，但更早历史数据未读取。
- 未验证 Catalog RPC 的 `is_test` exposure 是否被前端正确隐藏、测试/负载工具在哪里获得 service_role，或 Compatibility 数据库是否沿用 Canonical 的单一来源 cutover。
