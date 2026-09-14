# AU-572｜Storefront Compatibility 登录失败重置返回值修正

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260724121500_fix_login_reset_return.sql`（16 行）。
- 审阅方式：逐行人工审阅 function replacement 和 privilege；定向检索 Commerce API 调用者、Canonical 同名迁移及 migration history。未执行数据库调用。

## 审计结论

- **G0**：这是仍有实际 caller 的前向 API 契约迁移，不能删除。
- [FACT][E-AU-572-001] 它替换原 `void` 的 `api_clear_login_failures(text)`，在删除对应 IP hash 的登录失败记录后显式返回 `true`，并保留仅 service_role execute；不改变失败累计或封禁策略。
- [FACT][E-AU-572-002] `commerce-api` 的 public、WeChat auth、step-up 路由均以 `callRpc<boolean>` 调用该 RPC，返回类型与此迁移的修正一致。
- [FACT][E-AU-572-003] Compatibility 与 Canonical 同名 migration SHA-256 一致；它们必须在各自隔离 migration ledger 中 replay。

## 未验证项

- 未验证 RPC provider 如何处理 `false`/空返回、删除零行时是否仍满足客户端的业务语义，以及成功认证流程是否都可靠地调用重置。
- 未验证 IP hash 来源、代理地址链与当前阻断阈值；这些不由本返回值修正单独决定。
