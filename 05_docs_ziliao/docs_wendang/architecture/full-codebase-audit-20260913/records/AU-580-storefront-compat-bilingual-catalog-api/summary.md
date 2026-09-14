# AU-580｜Storefront Compatibility 双语目录 API 迁移

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260725010000_bilingual_catalog_api.sql`（38 行）。
- 审阅方式：逐行人工审阅 RPC replacement、scope/filter、projection 与 privilege；定向核对 Commerce API public catalog caller、later strict taxonomy migration和 Canonical 同名 migration。未执行 RPC。

## 审计结论

- **G0**：该 migration 是公共目录 RPC 的双语字段演进与历史重放契约，不能删除。
- [FACT][E-AU-580-001] `api_catalog` 仅按 mall slug、active mall/product/SKU 和可选 category 返回记录，限制 1–100 / 非负 offset；展示名/副标题优先中文字段，同时带回 source/Chinese 文本、taxonomy、classification status、库存和 is_test。
- [FACT][E-AU-580-002] anon/authenticated 被显式 revoke，仅 service_role 可执行；Commerce API `publicCatalogRoutes.ts` 在按 category 的公共目录读取路径调用 `api_catalog`，服务层是实际入口与身份/网络边界。
- [FACT][E-AU-580-003] `20260725013000_enforce_strict_catalog_taxonomy.sql` 后续重定义同一 signature，使高置信有效 taxonomy 成为最终可见性条件；不得将本中间版本的 `is_test` exposure或可见性条件当成固定基线最终行为。
- Compatibility/Canonical 同名 migration SHA-256 一致，仍各自隔离 replay。

## 未验证项

- 未执行公共 API/RPC，未验证 `api_public_catalog_window` fallback、Commerce API authorization、中文字段到前端的渲染/escaping，以及 service-role credential保护。
- 未核验 later strict taxonomy/qualification 已在 Compatibility 数据库应用，或低置信/测试商品在最终公开目录中是否被正确排除。
