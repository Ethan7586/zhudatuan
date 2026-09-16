# AU-646｜Allow Existing Consumer Identity Registration

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260903108000_allow_existing_consumer_identity_registration.sql`（62 行）。
- 审阅方式：逐段人工审阅 function rewrite 的前/后置条件，交叉检查 RegistrationOperations existing-account branch与 AU-642 registration trigger remaining proof requirements。未连接数据库或执行 migration。

## 审计结论

- **G0：保留。** migration 只移除 registration trigger 对 profile/credential 必须本 transaction 新建的要求，以允许已有消费者身份接受新的 storefront invitation；其余 invitation consume 和 registration challenge 的 transaction-bound proof保持不变。
- [FACT][E-AU-646-001] rewrite前精确要求旧 predicate 各出现一次，重写后要求完全消失；任一 function drift/partial rewrite 均 fail-closed。
- [FACT][E-AU-646-002] postcondition明确保留 `challenge.consumed_at>=transaction_timestamp()` 与 `invite.accepted_at>=transaction_timestamp()`，同时 AU-642 trigger 仍要求 active candidate membership、access version 1、未离开状态、有效 role/scope grant 和 invite destination credential match。
- [FACT][E-AU-646-003] RegistrationOperations existing-account path以 member + target organization + storefront client 查找已有 membership，缺失时创建新 membership；这一 migration 使已有 profile/credential 能通过数据库 registration boundary，而不放宽 invite/challenge consumption proof。

## 未验证项

- 未在真实 PostgreSQL 验证已有 consumer 注册第二 Mall、expired/reused invite、旧 challenge、stale/disabled credential 的完整反事实矩阵。
- 多 Mall qualification 数据模型后果另见 F-0270；本 migration 本身不写 qualification profile。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：不需要；对 F-0270 的独立复核应覆盖本 existing-consumer path。
