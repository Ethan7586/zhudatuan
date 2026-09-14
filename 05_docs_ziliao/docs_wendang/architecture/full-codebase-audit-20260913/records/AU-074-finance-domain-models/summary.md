# AU-074｜finance 领域模型与策略深审

- Account/Entry/Hold/Invoice/Journal/Payout/Period/Reconciliation/Settlement 只定义与数据库状态机一致的领域 wire shape，不承担持久化或副作用。
- PostingPolicy 以安全整数验证借贷平衡；SettlementPolicy 验证申请/批准分离、正数金额、0–5000 basis points、invoice basis 与向下取整的 fee/net split。
- FinancePolicy 测试覆盖借贷失衡、四眼、零金额、basis point 与 invoice basis 拒绝、确定性 split。未发现新的 P0–P3；Vitest 未执行（固定审计 worktree 无可执行文件）。
