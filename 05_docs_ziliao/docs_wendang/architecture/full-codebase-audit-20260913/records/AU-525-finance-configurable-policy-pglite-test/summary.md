# AU-525｜Configurable finance policy PGlite 工作流测试

- 审阅范围：`01_core_hexin/services/commerce/tests/repository/FinanceConfigurablePolicy.test.ts`（451 行）；定向追踪 FinancePolicyWorkflow、policy migration/DB procedures 与 action proof composition。
- 审阅方式：逐关键路径人工阅读；PGlite migration replay 未在本轮执行。

## 真实运行关系

Finance policy API workflow → preview configurable policy → user obtains action proof → command transaction 应消费 proof + 调 `finance.manage_configurable_policy` → draft/submit/approve/reject/retire state machine，含 expected version、idempotency、four-eyes reviewer、scope/kind/overlap、RLS/raw-write 与 immutable revision 边界。

## 审计结论

- **G0**：PGlite test 是 policy DB workflow 的重要规格，覆盖多 tax rule、生命周期、审批分离、stale/expired preview、idempotency mismatch、validation/RLS；不能删。
- **F-0243 补强**：test helper `managePolicy` 在测试 transaction 中显式调用 `access.consume_action_proof`，再调用 `finance.manage_configurable_policy`；实际 `FinancePolicyWorkflow` 只调用 preview/manage DB procedures，未消费 proof。故测试证明“正确 composition 应是什么”，不证明实际 API command 已防重放。
- `replayManageWithoutProof` 的同 idempotency 回放专门验证已完成命令 receipt 的安全重放，与新命令缺 proof 不是同一语义。

## 未验证项

- 测试 migration replay 截止指定版本；未执行真实 PostgreSQL、HTTP authorizer、stored procedure grants 或 concurrent approval/consume；F-0243 独立复核仍未完成。
