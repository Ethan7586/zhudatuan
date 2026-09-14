# AU-609｜Console Support 数据库边界

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260830101000_console_support_boundary.sql`（148 行）。
- 审阅方式：逐行人工审阅 Console/login role、schema/table/function grants、RLS policies、Owner support capability reconciliation 与 assertions；交叉检查 `ConsoleSupportHealth`、support module、后续 Console scope/Owner identity migrations。未连接数据库或执行迁移。

## 审计结论

- **G0：保留。** 本 migration 建立 Console API 独立 `zhudatuanconsoleapi` login role 与无登录、无继承 `shopconsole` runtime role，是 Console support API 真实 DB 访问边界。
- [FACT][E-AU-609-001] 先撤销八个 schema 的默认 function/table privilege 后，仅按职责授予 session/membership/scope resolver、support ticket/conversation/message、runtime idempotency/outbox、risk 与 audit 必要表；assert 明确拒绝 support agent/account/SLA、message update/delete、ticket insert/delete 等过宽 privilege。
- [FACT][E-AU-609-002] 每项 support/risk/audit business read/write 都附 `access.scope_allowed` 或 `risk/audit.scope_allowed` RLS 约束；membership select 仅可见 current app membership，decision/outbox/idempotency 也以当前 scope check 控制。
- [FACT][E-AU-609-003] `ConsoleSupportHealth` 以 `shopconsole`、support ticket/message、runtime idempotency 的存在性作为依赖健康检查，说明该角色/ACL 是实际运行契约。Owner support permissions/operations 同步写入并在 migration assert 中验证。
- [FACT][E-AU-609-004] 本历史 migration 与 AU-608 一样没有 database/predecessor/future-head guard；这是 F-0263 所述迁移执行边界模式的交叉证据，未重复新增 finding。

## 未验证项

- 未以 `zhudatuanconsoleapi` 登录真实数据库验证继承、RLS、support conversation/ticket 跨 scope 拒绝、outbox/idempotency 写入或 health endpoint；线上 role membership/旧 ACL 状态未验证。

## 结论等级

- 新增问题：无（F-0263 交叉关联）。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；任何 Console grant 变动都应以 `shopconsole` 的正反 scope fixture 验证而非只看 application role。
