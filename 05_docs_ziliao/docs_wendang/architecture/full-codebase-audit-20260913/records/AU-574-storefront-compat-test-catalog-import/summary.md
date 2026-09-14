# AU-574｜Storefront Compatibility 测试目录导入 RPC

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260725003000_test_catalog_import_rpc.sql`（109 行）。
- 审阅方式：逐行人工审阅 JSON input、supplier/product/SKU/inventory UPSERT、test flag 和 privileges；定向检查后续修正、Canonical cutover 与仓内调用。未执行导入。

## 审计结论

- **文件 G0；函数 G1（DC-0072）**：历史迁移和测试数据隔离职责必须保留。当前 `api_import_test_catalog` 在 Compatibility 数据库仍仅 service_role 可执行，但固定基线未找到应用/脚本调用，故作为需外部 test runner 复核的保守候选，而非删除结论。
- [FACT][E-AU-574-001] 输入限 1–200 项，要求 literal `abo_` ID 前缀、externalId/name；写入固定测试 supplier、`is_test=true` 商品、零价 SKU、零库存，并以稳定 ID UPSERT，普通用户无法获得 execute。
- [FACT][E-AU-574-002] AU-573 的 trigger 拒绝 test product 进入 order item；本 RPC 的零价/零库存和 is_test 标识与该隔离边界一致，不接入普通下单入口。
- [FACT][E-AU-574-003] `20260725005000_fix_test_catalog_import_rpc.sql` 对 JSON extraction 加括号重定义函数；Canonical later inventory single-source cutover 则明确 revoke/drop 此 RPC。Compatibility 目录未见等价 drop migration，不能从 Canonical 演进推断 Compatibility runtime 可删。
- Compatibility/Canonical 同名初版 migration SHA-256 一致，但两个数据库的 ledger 不能混跑。

## 未验证项

- 未验证仓外 E2E/load tooling、真实 service-role access、Compatibility 数据库现有 function state，或 200-item/error/rollback 反事实。
- 未核验 UPC/ID collision、强制 tenant/mall 固定值是否符合所有测试隔离需求，以及 purge/订单触发器在遗留 test data 下的行为。
