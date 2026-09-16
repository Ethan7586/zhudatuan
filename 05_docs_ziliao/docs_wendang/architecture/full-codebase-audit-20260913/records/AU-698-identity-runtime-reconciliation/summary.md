# AU-698｜Identity 运行状态 Reconciliation

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260912180000_reconcile_identity_runtime_state.sql`（89 行）及 `RegistrationMigrationPlan`/对应 unit tests。
- 审阅方式：深入审阅 member registration→Realm target projection、function ownership/execute ACL、catalog index re-registration、schema ledger reconciliation和 registration-profile 执行约束。

## 审计结论

- **G0：保留。** migration 是已验证 runtime object 的受控 reconciliation：重建 member node registration 后的 consumer Realm target projection，恢复 identity security-definer function owner/execute boundary和 Catalog index，并登记精确的 production reconciliation ledger facts。
- [FACT][E-AU-698-001] trigger 与 backfill 都从 registration host node 的 consumer target投影到 member Realm；`(realm_id,target)` 冲突键使重复 registration/replay 不重复创建 target。
- [FACT][E-AU-698-002] `RegistrationMigrationPlan` 仅把名称、source SHA-256、repair file与固定原因全数精确匹配的 `registration-reconciled` ledger row当作有效；任何额外 drift 都被拒绝。它不是通用迁移跳过机制。
- 该 migration 不直接写 membership、session、ticket或业务订单；未发现新的可证实权限/数据问题。

## 未验证项

- 未读取生产 `supabase_migrations.schema_migrations`、function owner或现存 Realm target，不能确认线上 reconciliation 是否完整、是否曾执行或是否需再次执行。
- 未全量 replay registration profile；该运行路径的真实外部数据库状态不在审计分支内变更。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（Identity runtime reconciliation and guarded registration ledger）；不新增 G1/G2/G3/GX。
- 二次复核：否；任何修改 reconciliation 条目或触发器必须复核实际 production ledger和重复 registration target投影。
