# AU-582｜Storefront Compatibility ABO taxonomy 校准迁移

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260725012000_recalibrate_abo_taxonomy.sql`（85 行）。
- 审阅方式：逐行人工审阅 node/mapping UPSERT、test-only resolve/backfill、review queue transition 与 governance summary；未执行 migration。

## 审计结论

- **G0**：这是由外部 ABO 测试目录 productType 驱动的 taxonomy 校准历史，不能删除。
- [FACT][E-AU-582-001] 增补 apparel/mobile taxonomy path；从 `is_test=true` items 的 `detail_json.productType` 创建 supplier-test-abo reviewed mapping，映射成功后根据真实 parent chain 填写产品 L1/L2/L3、category、0.88 confidence 和 taxonomy version。
- [FACT][E-AU-582-002] 只把达到 ≥0.8 且翻译仍 pending 的 pending review 项从 `both` 缩为 `translation`；不会标记翻译完成，也不改变已审核/非测试产品。
- [FACT][E-AU-582-003] 重定义 service-role governance summary，以 review queue 而非仅 products 统计待翻译，后续 strict taxonomy 和 mobile taxonomy 继续演进 2026.07/2026.08 边界。Compatibility 与 Canonical 同名 migration SHA-256 一致但不可混跑。

## 未验证项

- 未验证 source productType 的实际大小写、regex 覆盖和 mapping 准确率，0.88 confidence 的经验依据、远端 review queue/审核流程或任一 test record 是否错误获得公开资格。
- 未验证后续 strict taxonomy/qualification gate已在 Compatibility database执行；本数据校准本身不独立保证最终 public catalog visibility。
