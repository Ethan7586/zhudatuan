# AU-528｜Hosted node provisioning PostgreSQL 引擎测试

- 审阅范围：`01_core_hexin/services/commerce/tests/repository/HostedNodeProvisioningEngine.test.ts`（149 行）；定向追踪 HostedNodeProvisioningPort 与 node/realm/relation/provisioning facts。
- 审阅方式：逐段人工阅读；测试需要 runtime/admin PostgreSQL endpoint，本轮未执行。

## 真实运行关系

Provisioning request → transaction → HostedNodeProvisioningPort → organization node + relation + hosted provisioning request facts。测试以独立 admin/runtime connections 注入 race、trigger failure、idempotency replay 和 node-id contention，随后用 admin connection 检查事实表数量。

## 审计结论

- **G0**：这是真实 PostgreSQL concurrency/rollback test，不是 mock。它要求五个相同请求仅建一组事实、注入 relation 后失败必须完整回滚、竞争 id 只能一个 idempotency key 成功；这些均是 hosted node 数据所有权与重试安全契约。
- 测试仅在两个明确 endpoint 都存在时运行；当前没有运行证据，不能把其预期结果写为运行事实。

## 未验证项

- 未获取 admin/runtime DB endpoint；真实 migration head、RLS/role、长事务/连接耗尽、cleanup 与生产 deployment concurrency 未验证。
