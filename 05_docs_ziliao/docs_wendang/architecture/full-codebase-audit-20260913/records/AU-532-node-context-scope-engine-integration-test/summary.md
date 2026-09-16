# AU-532｜Node context/scope PostgreSQL 引擎测试

- 审阅范围：`01_core_hexin/services/commerce/tests/repository/NodeContextScopeResolverEngine.test.ts`（168 行）；结合 AU-513 再核对其 node relation history 路径。
- 审阅方式：逐段人工阅读；需要 admin/runtime PostgreSQL endpoint，本轮未执行。

## 审计结论

- **G0**：integration test 以 hosted L2–L11 chain 验证 authoritative node context 不接受 forged payload、self/ancestor/descendant/subtree 直接读 current closure、旧 relation 保留历史但 resolver 只取 current version、suspended node 状态可见。是节点关系版本化与跨级 scope 的真实规格。
- 该测试补齐 AU-513 所审 adapter 的数据库行为覆盖；源/单测与集成测试各有责任，不能因重叠而删除。

## 未验证项

- 环境变量未提供时测试跳过；真实 RLS/grant、relation 变更竞争与性能均未执行验证。
