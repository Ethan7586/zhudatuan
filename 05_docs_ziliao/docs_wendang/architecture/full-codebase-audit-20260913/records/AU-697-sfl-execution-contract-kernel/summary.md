# AU-697｜SFL 执行契约内核

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260912170000_create_sfl_execution_contract_kernel.sql`（44 行），`ExecutionKernel`、静态 contract checker 与 PostgreSQL 17 fixture。
- 审阅方式：深入审阅 runtime idempotency metadata、business-number uniqueness、purchase completion write、Web outbox RLS、operation-completed event、transaction rollback/concurrency 和实际 runtime writer。

## 审计结论

- **G0：保留。** migration 是 79 条 runtime critical write 的共享 execution metadata/boundary，不是孤立 schema 扩展。`ExecutionKernel` 在同一 transaction 写 started record、completion outbox 及 completed response/state；business number partial unique index防止重复业务回执。
- [FACT][E-AU-697-001] state/hash constraints、business number unique、purchase API column-level update、Web API outbox insert/RLS和 `runtime.operation.completed:v1` event构成最小内核契约；Web outbox policy以 `access.web_scope_allowed(scope_id)` 约束。
- [FACT][E-AU-697-002] `npm run check:sfl-execution-contract-kernel` 于 2026-09-15 通过：静态 inventory 显示79条 runtime critical write 的 transaction/idempotency/state/outbox/business-number/audit/schema/sdk/bypass/hash 状态均 PASS；PostgreSQL 17 fixture通过 constraints、grants、RLS、rollback和 five-way idempotency。

## 未验证项

- 未读取生产 idempotency/outbox/event 消费状态，不以本地 fixture推断线上积压、重复或补偿执行。
- 内核只验证公共执行协议；具体业务 operation 的领域补偿语义、外部 side effect 和 downstream consumer reliability仍由对应审计单元负责。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（runtime execution contract kernel）；不新增 G1/G2/G3/GX。
- 二次复核：否；任何更改 idempotency state、outbox grant/RLS或 shared event schema必须复跑静态和 PG17 checks。
