# AU-579｜Storefront Compatibility 双语目录分类基础迁移

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260725009000_bilingual_catalog_taxonomy.sql`（74 行）。
- 审阅方式：逐段人工审阅 schema/constraints、source projection、test-only classifier、index 与后续 catalog consumers；未执行数据库迁移。

## 审计结论

- **G0**：该文件建立当前目录双语与 taxonomy 数据模型的共同基础，不能删除。
- [FACT][E-AU-579-001] products 新增来源/中文展示文本、翻译/分类状态和 0–1 confidence 约束、三级 taxonomy；`name_en` / `subtitle_en` 仅从现有来源字段补齐，注释明确 `name_zh` 不得覆盖来源名称。
- [FACT][E-AU-579-002] 关键词机器分类仅作用于 `is_test=true` 项；未命中被明确标为 `welfare_review`、confidence 0.35，其余为 machine_classified 0.72，未伪装为人工审核。
- [FACT][E-AU-579-003] 后续 bilingual API、catalog governance、recalibration、strict taxonomy、commercial resource 和 mobile catalog migrations读取本迁移字段/状态；review index 服务于分类处理。Compatibility 与 Canonical 同名 migration 哈希一致但不可混跑。

## 未验证项

- 未验证真实测试目录的分类/翻译准确率、regex 的多语言覆盖、confidence 含义和后续审核流程；本文件没有中文翻译写入，不能据此宣称商品已双语完成。
- 未 replay 数据库或核验远端 schema/历史 rows，未验证 downstream public eligibility 是否正确使用 `classification_confidence`。
