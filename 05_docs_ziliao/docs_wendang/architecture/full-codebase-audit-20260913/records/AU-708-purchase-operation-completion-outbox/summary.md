# AU-708｜Purchase Operation Completion Outbox

- 审阅范围：`20260913021600_align_purchase_operation_completion_outbox.sql`、ExecutionKernel、Payment operation support、Purchase API readiness和既有 Purchase outbox policy。
- 审阅方式：深入审阅 critical-write completion event的 scope/aggregate/payload、Purchase RLS policy的 select/insert分支和 API transaction session context；重复 payment helpers按结构性审阅。

## 审计结论

- **G0：保留。** migration将 `runtime.operation.completed` 的 owner/member-scoped completion receipt纳入 Purchase API outbox RLS，而保留 quote/order/payment等既有 Mall-scoped lifecycle event分支。
- [FACT][E-AU-708-001] ExecutionKernel把 critical write completion写为 aggregate `operation`，scope为 claim scope；Purchase policy只允许 `access.purchase_member_allowed(scope_id)` 的 select/insert，底层 predicate依赖 API transaction设置的 membership/actor session variables。
- [FACT][E-AU-708-002] Purchase API startup要求 outbox INSERT权限，payment transaction在同一 transaction设置 database context；operation completion采用固定 event id并 `on conflict do nothing`，随后更新 idempotency checkpoint，保持重放不重复发布。
- 本模块没有新增独立问题。policy没有扩大 public或跨 Mall event读取；它是 AU-697 execution contract与既有 Purchase RLS的必要对齐。

## 未验证项

- 本次未以真实 `zhudatuanpurchaseapi` role重放该后置 policy migration；AU-697已运行 execution kernel验收，但其范围不等于本 migration 的所有 RLS分支。
- 未读取生产 outbox events、session context或Purchase connection role，未声明线上 receipt可见性状态。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项；不新增 G1/G2/G3/GX。
- 二次复核：不要求新增独立复核；若改 RLS/event schema或Purchase scope语义，必须用真实 role验证本 membership allow、其他 membership deny、Mall order events allow和未经允许 event insert deny。
