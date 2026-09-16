# AU-604｜Owner 个人 Scope 与发票 Scope

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260829214000_owner_personal_scope_and_invoice_scope.sql`（169 行）。
- 审阅方式：逐行人工审阅 boundary guard、`resolve_membership`/`resource_scope` 定向重写、invoice fixture assertion 与 schema marker；交叉检查 Finance invoice operations、QuoteReader、OperationController、registration plan 及后续 owner personal-scope restore migration。未连接数据库或运行 migration。

## 审计结论

- **G0：保留。** 该 migration 为当前/未来 platform Owner 派生个人 member scope，同时修正 invoice member 与 operator operation 的 resource scope；它不新增可变 Owner grant，而是从 singleton 的 canonical membership 推导，不能删除。
- [FACT][E-AU-604-001] 对 active Owner，`resolve_membership` 在既有 Owner+self role 与 platform/tenant/self grants 之外，派生 owner(member) scope 并赋予 `role:self` 的 member profile/address permissions；条件同时要求没有现有 owner scope grant，避免重复可变授权行。
- [FACT][E-AU-604-002] `resource_scope` 改写将 `invoice.profiles.read` 和 `invoice.requests.create` 保持为个人 member scope；`invoice.requests.read` 走 membership organization；`invoice.profiles.manage` 对具体 profile 取 owner_id、未创建资源则回退 membership organization。最终 assertion 用真实 resolver 与临时 invoice profile 验证四种语义。
- [FACT][E-AU-604-003] Finance invoice command/read、Checkout QuoteReader 和 OperationController 是该 scope 区分的实际消费者；RegistrationMigrationPlan 将其作为受控 backfill。后续 `20260901210000_restore_platform_owner_personal_scope_projection.sql` 仍引用这个演进主题，因此不得孤立重排或删除本历史 migration。

## 未验证项

- 未执行 resolver rewrite、Owner active/inactive、invoice list/create/manage 的 allow/deny、动态 SQL replacement failure 或后续 restore 的实际 replay；真实实例 Owner scope 形态未知。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；若调整 resolver 结构，必须把字符串 replacement 改动与 owner/invoice scope integration tests 同时验证，避免静默 rewrite 漏配。
