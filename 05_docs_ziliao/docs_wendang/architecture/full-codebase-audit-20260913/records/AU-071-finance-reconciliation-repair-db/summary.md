# AU-071｜finance 对账修复数据库权威过程与集成测试深审

- 修复迁移将 repair、两条平衡 repair line、execute/reverse effect 与 transaction-local authorization 设为不可变状态机；客户端只可执行五个封装函数，底表默认拒绝。
- preview 从 payment/refund、provider effect、statement/reconciliation、ledger/period 等权威事实重建会计计划，固化 source/target hash 和五分钟 preview；submit/decide 在 hash、版本、行和 action-proof 一致时推进；approve 精确校验 journal/entry 后更新对账项，reverse 仅在未审批/未产生 settlement 时生成精确反转。
- repository PGlite 测试重放至该迁移，覆盖 preview→submit→第二人 approve→read→reverse、幂等重放、错误版本/hash/proof/self-review/cross-scope/closed period、底表默认拒绝、退款事实封存与 downstream lock。
- 未发现新的 P0–P3；本单元的关键数据库状态机有真实 PostgreSQL 兼容行为 oracle。未运行定向 Vitest：固定审计 worktree 无可执行 `vitest`，未安装依赖或改变运行状态。
