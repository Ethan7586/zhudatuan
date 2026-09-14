# AU-581｜Storefront Compatibility 目录治理基础迁移

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260725011000_catalog_governance.sql`（203 行）。
- 审阅方式：逐段人工审阅 taxonomy、supplier mapping/rule/review queue 表、test-only L3 backfill、governance summary和后续 strict taxonomy guard；未执行 migration/RPC。

## 审计结论

- **G0**：这是目录 taxonomy、审核和供应商分类治理的基础数据迁移，不能删除。
- [FACT][E-AU-581-001] 建立三级 taxonomy nodes、supplier category mappings、classification rules和每商品唯一的 review queue，并为状态、置信度、父子引用及 test-product 级联清理提供数据库约束；catalog governance fields 有真实后续 consumers。
- [FACT][E-AU-581-002] taxonomy nodes/rules 通过 stable IDs UPSERT；仅 `is_test=true` products 被回填 L3，低 confidence 或 pending translation 测试项进入 review queue，queue UPSERT 不会重复创建同一 product 条目。
- [FACT][E-AU-581-003] `api_catalog_governance_summary` 为 service_role 受限诊断；无仓内应用调用，但表/规则/review queue 及其历史迁移责任不依赖它的直接 caller。later `20260725012000_recalibrate_abo_taxonomy.sql` 重定义 summary，`20260725013000_enforce_strict_catalog_taxonomy.sql` 增加真实 parent-level path validation/公开资格边界。
- Compatibility 与 Canonical 同名 migration SHA-256 一致，两个数据库仍须各自 replay。

## 未验证项

- 未验证 taxonomy tree、supplier mapping/rules 的实际审核流程、外部 governance runner、远端 review queue 状态或真实测试商品的回填准确率。
- 本文件初版不自行强制 products L1/L2/L3 的父子组合；later strict migration 已提供验证函数/trigger，但 Compatibility DB是否已应用该终态未验证，故不把后续保护写为本文件已独立保证。
