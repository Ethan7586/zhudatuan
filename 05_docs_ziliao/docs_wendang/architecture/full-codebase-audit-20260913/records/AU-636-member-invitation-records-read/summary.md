# AU-636｜Member Invitation Records Read

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260902139000_add_member_invitation_records_read.sql`（24 行）。
- 审阅方式：逐行人工审阅 runtime/capability/entitlement/ledger 写入；反向追踪 Member read action、Console query、SDK/contract、模块注册与定向 unit contract。未连接数据库或执行 migration。

## 审计结论

- **G0：保留。** migration 注册受 `identity.invitation.manage` 保护的 operator invitation records read operation；MemberReadOperations 只返回掩码目的地、状态与关联人展示字段，按 current scope 的 organization tree 做 keyset 分页，不返回 invite token/hash。
- [FACT][E-AU-636-001] 数据库注册的 GET path、operation owner、capability、permission、operator audience 与 platform entitlement，与 contract/SDK/Console `InvitationRecordsQuery` 和 `MemberReadOperations` 的 registered action 对齐。
- [FACT][E-AU-636-002] 查询仅选择 `destination_masked`，以 `unitclosure` 限制 invitation storefront/organization 在 current scope tree 内；定向 unit contract 验证 scope predicate、cursor order 与无可恢复 secret 输出。
- **F-0269（P3）**：同文件把 `runtime.schemaversion` version `20260821032000` 的 checksum 从 `a634…` 改为 `f0c4…`，但条件只在旧值为 `a634…` 时更新且未检查 affected row。正式 sorted migration chain 在更早 `20260830103000_identity_runtime_contract_visibility.sql` 已把该 version 改为 `d7e499…`；因此此 update 在完整顺序中为零行静默成功，留下未反映本 operation 的旧 contract checksum。

## 未验证项

- 未以真实 RLS role 调用该 GET endpoint；应用层 unit contract 不能替代 PostgreSQL 数据库角色验证。
- 未确认外部部署是否将此 `runtime.schemaversion` checksum 用于 readiness/发布 gate；仓内 Node/runtime 检索未找到直接 consumer，故 F-0269 不上调为运行中断。

## 结论等级

- 新增问题：P3 1 项（F-0269）。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：不需要；修复前需由 migration/runtime-contract 所有者确认历史线性 schema ledger 与外部 readiness consumer。
