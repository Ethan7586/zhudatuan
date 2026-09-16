# AU-513｜AuthoritativeNodeContextResolver 与索引 scope

- 审阅范围：`01_core_hexin/services/commerce/src/foundation/security/AuthoritativeNodeContextResolver.ts`（45 行）与同名 unit test（55 行）；定向复核 `tests/repository/NodeContextScopeResolverEngine.test.ts`、节点 scope migration/contracts 及已有 AU-275 记录。
- 审阅方式：逐段人工阅读、静态调用/契约追踪；集成测试依赖数据库环境变量，本轮未执行。

## 真实运行关系

Provisioning/runtime DB connection → `PgAuthoritativeNodeContextResolver.resolve(targetNodeId)` → `organization.resolve_node_context` 返回唯一持久权威字段 → node scope resolver 用 `(line_id,node_id)` 调 self/ancestors/descendants/subtree closure 函数。repository integration test 在有 runtime/admin 数据库连接时创建跨 L2–L11 节点并验证同一实现；对应 SQL functions 有 revoke/grant 与 contracts 定义。

## 审计结论

- **G0**：resolver 仅接受 server target node id，不接收 manifest、secret binding 或 client forged authority fields；0/多行及 parse 失败 fail-fast。scope resolver 始终带 line/node 双键，并拒绝跨 line 返回记录。
- 深度无关 closure SQL（非递归约束）和多层 hosted/sovereign 集成测试是实际数据模型契约，不是遗留测试。
- 已有 AU-275 曾记录同一实现结论，但这两个 manifest 行未被更新；AU-513 只补齐文件级覆盖证据，未改变旧结论。

## 未验证项

- 因缺少明确 test database endpoint，本轮未运行受 `SHOP_TEST_DATABASE_URL`/`SHOP_TEST_ADMIN_DATABASE_URL` 控制的 integration test；真实 RLS、role grant 和 closure 性能仍未验证。
