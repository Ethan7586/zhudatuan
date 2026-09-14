# AU-080｜finance 发票端口与运行模块装配深审

- `InvoiceIssuer` 是 InvoiceJob 与 InvoiceGateway 之间的唯一 typed port：original/red、原票 external id、敏感 profile 文本、金额/税行、PDF receipt 都在契约中。
- FinanceModule 将完整 FinanceRoutes 作为依赖 reporting 的 Commerce business module 注册；IdentityOperatorFinanceModule 仅注册 operator read allowlist，实际由 Identity registration API 使用。
- 未发现新的 P0–P3；运行模块入口已有 Identity entrypoint 集成测试覆盖。未运行 Vitest（固定审计 worktree 无可执行文件）。
