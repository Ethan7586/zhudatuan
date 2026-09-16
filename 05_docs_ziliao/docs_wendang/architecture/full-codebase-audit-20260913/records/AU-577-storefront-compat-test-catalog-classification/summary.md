# AU-577｜Storefront Compatibility 测试目录分类迁移

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260725007000_classify_test_catalog.sql`（26 行）。
- 审阅方式：逐行人工审阅 CTE scope、分类 regex 与写入范围；定向比对 history、Canonical 同名 migration及后续 taxonomy 链路。未执行数据更新。

## 审计结论

- **G0**：这是对既有 test catalog 的一次性前向数据投影，具有 migration ledger/history 责任，不能删除。
- [FACT][E-AU-577-001] CTE 只选择 `is_test=true` products；依据名称、subtitle、model/productType/description 的英文关键词将 category 收敛为 food、digital、appliance、personal、home、supermarket 或 welfare，然后仅更新这些行的 `category_code` / `updated_at`。
- [FACT][E-AU-577-002] 该文件不注册 RPC、route、worker 或周期任务；其无静态 runtime caller 是数据 migration 的正常触发模式，不是删除证据。
- [FACT][E-AU-577-003] Compatibility 与 Canonical 同名 migration SHA-256 一致；后续 taxonomy/catalog governance 使用 test data 的分类结果，且两库 migration ledger 不得混跑。

## 未验证项

- 未在真实 test items 上验证关键词分类准确度、中文字段覆盖、fallback `welfare` 比例或是否需要人工校正；该迁移只面向测试数据，未将分类启发式提升为生产目录规则缺陷。
- 未检查远端历史 ledger 是否已经执行、是否存在重放/rollback 数据需求，或后续 taxonomy migration 对所有分类值的最终约束。
