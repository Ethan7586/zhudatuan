# AU-576｜Storefront Compatibility 测试目录统计 RPC

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260725006000_test_catalog_stats_rpc.sql`（28 行）。
- 审阅方式：逐行人工审阅 read-only 统计 shape、privilege及后续重定义/Canonical cutover；未执行数据库统计。

## 审计结论

- **G0**：该 source migration 记录受限诊断契约及其后续撤销演进，不能因当前无业务 route 或 Canonical 的终态删除而删除。
- [FACT][E-AU-576-001] 初版 `api_test_catalog_stats` 只读返回总量/测试 product、SKU、inventory 计数和当前 DB byte size，execute 仅授予 service_role，未写入业务数据。
- [FACT][E-AU-576-002] 后续 Compatibility `20260725008000_test_catalog_category_stats.sql` 以同一 signature 重定义并增加测试类目统计；Canonical inventory single-source cutover 随后显式撤权/删除该函数，且 contract test 断言其不存在。
- [FACT][E-AU-576-003] Compatibility 与 Canonical 同名初版 migration SHA-256 一致，但 cutover 文件和最终 DB 状态不应跨数据库推断；两条历史 ledger 均有独立 replay 责任。

## 未验证项

- 未读取 Compatibility DB 的最终 `pg_proc` / privileges，未验证是否存在仓外 test/load monitoring consumer，或 database size 指标是否应暴露给 service-role runner。
- 未执行真实统计，未验证大表计数/数据库大小在运行时的成本和该 RPC 是否仍由后续 migration 保留。
