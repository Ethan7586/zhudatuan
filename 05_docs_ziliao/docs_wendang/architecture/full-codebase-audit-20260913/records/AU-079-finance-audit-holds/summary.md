# AU-079｜finance 审计账与冻结资金读取深审

- `finance.audit.read` 只在 authenticated scope 的组织闭包内读取 finance/invoice 相关审计 record，以 recorded_at/id 进行 keyset 分页。
- `finance.holds.read` 由已审阅的 lifecycle runtime 提供，基于 access.scope_allowed 与组织闭包读取 account/hold；FinanceAuthority 测试仅验证 audit/policy/operator profile query 的基本路由调用，不覆盖 audit/hold 隔离和分页行为。
- 未发现新的 P0–P3；定向 Vitest 未执行（固定审计 worktree 无可执行文件）。
