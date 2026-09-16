# AU-583｜Storefront Compatibility 严格目录 taxonomy 迁移

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260725013000_enforce_strict_catalog_taxonomy.sql`（78 行）。
- 审阅方式：逐行人工审阅 path predicate、product trigger、public catalog replacement、taxonomy audit 和 privileges；定向核对 Commerce API caller及后续 commercial/mobile catalog consumers。未执行 SQL。

## 审计结论

- **G0**：这是公开目录和 active product taxonomy 数据完整性的关键执行边界，不能删除。
- [FACT][E-AU-583-001] `is_valid_catalog_taxonomy_path` 要求 active level-1 → level-2 → level-3 的真实 parent chain；product trigger 对 active、non-pending classification 写入拒绝无效路径，并由 L1 回写 category_code。
- [FACT][E-AU-583-002] 重定义后的 `api_catalog` 同时要求有效 path、classification confidence ≥0.8、active mall/product/SKU；因此 pending/低置信/无效路径记录不会进入这个公共 catalog RPC。Commerce API public category route 是该 RPC 的实际调用入口。
- [FACT][E-AU-583-003] taxonomy audit 仅 service_role；同一 path predicate 继续被 commercial resources/employee qualification 与 mobile catalog migrations使用，形成公共展示和资格判断的共享数据契约。Compatibility/Canonical 同名 migration SHA-256 一致但不可混跑。

## 未验证项

- 未执行 trigger/RPC 反事实，未验证所有现存 active records 在迁移时均有有效 path；当前远端 ledger/RLS/privilege 状态与 API service-role boundary未读取。
- trigger 对 `classification_status='pending'` 的 active product保留例外，但公开 RPC仍会以有效路径和 ≥0.8 confidence 排除；未验证其他非本 RPC 的读取路径是否同样执行可见性约束。
