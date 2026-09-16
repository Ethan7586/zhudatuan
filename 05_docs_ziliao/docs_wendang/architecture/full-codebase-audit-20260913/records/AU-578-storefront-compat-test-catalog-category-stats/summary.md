# AU-578｜Storefront Compatibility 测试目录分类统计

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260725008000_test_catalog_category_stats.sql`（34 行）。
- 审阅方式：逐行与 AU-576 初版统计对比，人工审阅 JSON 聚合、权限继承和 later cutover 关系；未执行统计。

## 审计结论

- **G0**：此文件是受限诊断函数的前向演进 migration，不能删除或折叠进历史初版。
- [FACT][E-AU-578-001] 它保留产品/SKU/inventory/DB size 计数，并新增仅 `is_test=true` product 按 `category_code` 分组的 `testCategoryBreakdown` JSON object；无业务写入。
- [FACT][E-AU-578-002] signature 未变且仅 `create or replace`，因而沿用 AU-576 已设置的 service_role grant；未增加 anon/authenticated 权限。
- [FACT][E-AU-578-003] Canonical later inventory cutover 显式删除此函数，但 Compatibility 未见等价终态；独立 ledger/history 与仓外 diagnostics consumer 未排除，不能把不同数据库的 deletion 当作本文件垃圾证据。

## 未验证项

- 未验证 category_code NULL/重复 key 的 `jsonb_object_agg` 行为，实际统计成本、外部诊断 caller及 Compatibility 最终 function/privilege。
- 未执行 Canonical 或 Compatibility migration replay；两者同名 migration SHA-256 一致但不能跨数据库混跑。
