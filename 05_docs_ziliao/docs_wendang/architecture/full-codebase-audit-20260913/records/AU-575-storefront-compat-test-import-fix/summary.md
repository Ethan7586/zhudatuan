# AU-575｜Storefront Compatibility 测试目录导入表达式修正

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260725005000_fix_test_catalog_import_rpc.sql`（104 行）。
- 审阅方式：逐行与 AU-574 初版做 diff，人工复核 RPC signature/权限继承与后续 migration。未执行数据库 RPC。

## 审计结论

- **G0**：这是前向 migration replay 所需的 expression-parsing 修正，不能删除或与初版折叠。
- [FACT][E-AU-575-001] 唯一语义变更是为 JSON 文本 extraction 添加显式括号：`item->>'id'`、`externalId` 的字符串拼接以及 SKU ID 拼接；输入范围、固定测试 scope、is_test/零价/零库存 UPSERT 和返回 count 都没有变化。
- [FACT][E-AU-575-002] 本迁移不重复 revoke/grant；PostgreSQL `create or replace function` 保留 AU-574 已建立的 service_role privilege，不会扩大 anon/authenticated 权限。
- [FACT][E-AU-575-003] Compatibility 与 Canonical 同名 migration SHA-256 一致；AU-574 的 G1 仅针对最终 Compatibility RPC 外部 consumer 未明，不把此历史修正另计为候选。

## 未验证项

- 未以真实 PostgreSQL parser 运行含 JSON items 的 RPC，未验证该显式括号在目标版本的具体解析差异；本地没有可用数据库工具。
- 未验证 Compatibility 后续是否还撤销/删除该 RPC、外部 test runner 是否调用，或已有数据在回放时的成功/失败状态。
