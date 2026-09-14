# AU-065｜finance 周期关闭、backfill 与生命周期 API 深审

- 本单元覆盖 FinanceRoutes 的组合入口、financeLifecycleOperations 的 reconciliation/settlement/withdrawal/hold/period/backfill 读取和 period/backfill 管理。
- 所有读取以 access scope closure 或 access.scope_allowed 约束；周期关闭请求先固定 journal/entry source hash，批准/拒绝要求不同 requester/approver、相同 hash 和 pending 状态。批准时关闭 period、finalize draft statement 并发出 period.closed outbox；拒绝恢复 open。
- backfill 决策要求 pending、prepared_by 与 signer 分离且 target/source hash、count、minor 一致。路由把这些能力同其他 Finance 专项 operation 注册到 ModuleOperations。
- 新增 F-0152/P2：period close/backfill 的行为、并发、hash 变化和事务回滚没有模块专用测试；现有测试仅断言 manifest operation 列表。固定审计 worktree 无 vitest 可执行文件，未安装依赖；未发现 P0/P1。
