# AU-073｜finance 账单与多运行模块读取契约深审

- 完整 Finance module 的 `GetBills` 注册 entries/statement read 和 statement export；entries 只读 scope 闭包内 posted journal，statement read 却允许所有 draft/final statement。
- Identity Operator selected Finance module 以相同 operation id 提供独立 `FinanceReadOperations`；entries 查询相同，但 statement read 额外要求 `calculation_version=2 and balanced` 并返回 account projection；同一 operation 在两个真实运行单元具有不同结果和字段。
- FinanceRoutes 测试仅确认 operation catalog/wiring，未检验这两个实现的等价性或 draft statement 可见性。新增 F-0157/P2；未发现 P0/P1，Vitest 未执行（固定审计 worktree 无可执行文件）。
