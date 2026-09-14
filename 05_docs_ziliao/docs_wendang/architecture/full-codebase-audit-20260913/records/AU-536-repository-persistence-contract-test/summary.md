# AU-536｜Commerce repository PostgreSQL 持久化契约测试

- 审阅范围：`01_core_hexin/services/commerce/tests/repository/Repository.test.ts`（115 行）；定向阅读 `DatabaseHarness`、`PgScopeResolver` 与运行时 inbox/job SQL 入口。
- 审阅方式：逐关键逻辑人工阅读；测试依赖 `SHOP_TEST_DATABASE_URL` 或 `PGHOST`，本轮未执行。

## 真实运行关系

消息消费者 → `runtime.accept_inbox` → inbox 去重；JobRunner → `runtime.claim_job` → worker lease；HTTP/API transaction 设定 `shopapp` role 与 scope GUC → `risk.policy` RLS；Console 平台 Owner → `PgScopeResolver`/`AccessPipeline` → member profile operation 的 scope 拒绝与 decision audit。

## 审计结论

- **G0**：这是以真实 PostgreSQL 连接检查 inbox replay、并发 job claim、DB role/RLS query 与平台 Owner scope 防线的 repository contract test。`DatabaseHarness` 负责 finally rollback、局部 fixture 删除和 connection close；第二场景是只读查询。
- **F-0256（P2，高置信）**：RLS 断言仅以 `policies.rows.every(...)` 判断；当结果为零行时仍为 true，且测试未 seed 或断言至少有一条 `risk.policy` fixture。因此该 test 可以在风险策略表为空、RLS 过滤全部数据，甚至 test endpoint 未准备预期 fixture 时通过，不能证明其标题声称的 scope isolation。

## 未验证项

- 未运行真实 endpoint；无法确认 endpoint 是否隔离、是否始终带有 `rls-scope-a`/platform owner fixture、数据库 migration/role 初始化顺序，以及 SQL function 的实际 lock/RLS policy 定义。
