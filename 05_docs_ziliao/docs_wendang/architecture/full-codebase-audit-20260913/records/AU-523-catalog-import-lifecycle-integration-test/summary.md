# AU-523｜Catalog import PostgreSQL 生命周期集成测试

- 审阅范围：`01_core_hexin/services/commerce/tests/repository/CatalogImportLifecycle.test.ts`（153 行）；定向追踪 CatalogImportOperations、CatalogImportProcessor、runtime job schedule 与 fixture对象。
- 审阅方式：逐段人工阅读；测试受 `SHOP_TEST_DATABASE_URL`/`PGHOST` 控制，本轮未执行。

## 真实运行关系

Console mall-scope upload operation 在 DB transaction 创建 uploaded import → Catalog import worker 读取受 hash/scan 约束 package，验证/stage 后变 ready → Console confirm operation 在 transaction 将其转 running 并安排 validation/confirm runtime jobs。测试使用 UUID scope、唯一 object hash 与 finally cleanup，仅触及其创建 import/row/error/job。

## 审计结论

- **G0**：这是少数连接 PostgreSQL 的完整 import chain 测试，不是 mock-only；断言 upload idempotency 初态、真实 validation state/count、confirm state 和两个 queue payload。ObjectStore 刻意拒绝不应出现的 report/write/authorize 调用，限定本阶段副作用。
- 测试以环境存在才运行，当前静态审阅不能将其视为已经通过；它也没有覆盖失败、重复 confirm、并发、cancel、report 写入或真实 queue claim。

## 未验证项

- 未获取或使用任何数据库 endpoint，故 PostgreSQL migration/role/RLS、事务一致性和 finally cleanup 成功均未验证。
