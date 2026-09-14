# AU-633｜Administrator Invitation Runtime Alignment

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260902136000_administrator_invitation_runtime_alignment.sql`（429 行）。
- 审阅方式：逐段人工审阅 operator invitation constraint、governance predicate、registration trigger 与 RLS policy；交叉追踪 IdentityRegistrationApi 的模块/operation 注册、邀请 create/revoke application flow，以及应用层 invitation unit contract。未连接数据库、执行 migration 或调用真实邀请接口。

## 审计结论

- **G0：保留。** migration 将原有“待授权管理员”邀请边界扩展为 pending/senior-administrator 两种受控 operator role，并把 runtime role、tenant scope、单次手机号绑定、有效 permission、deny override 与 owner-only senior delegation同时限制在数据库层。
- [FACT][E-AU-633-001] `access.zhudatuan_operator_invitation_allowed` 只接受 `shopapp`/`zhudatuanidentityapi`，要求 tenant 根 scope、精确 Owner 或 Senior Administrator；非 Owner 只能创建 pending operator，不可签发 senior administrator 邀请。
- [FACT][E-AU-633-002] `member.protect_zhudatuan_invite_update` 将创建、撤销和匿名消费分开约束；operator 邀请固定 tenant、单次、destination hash，注册时再要求同一事务内的 credential、challenge、membership、role 和 scope grant 完整匹配。
- [FACT][E-AU-633-003] `IdentityRegistrationApiMain` 实际注册 `IDENTITY_REGISTRATION_OPERATION_IDS`，其中包含 invitation create/revoke；`membershipInvitationOperations` 的应用层同样要求 console target、operation capability、`identity.invitation.manage` 与 owner/senior governance，再将 invitation 写入当前 tenant scope。因此未发现数据库 ACL 与该邀请 runtime 的入口断链。
- [FACT][E-AU-633-004] 后续 `20260902137000` 以本 migration 的 version/checksum 作精确前置条件；标准顺序继续可追踪。AU-628 已记录的更早 migration 阻断仍是全库重建的外部前提，未在本 AU 重复登记。
- **F-0268（P3）**：当前 senior administrator 邀请的数据库防线没有对应的直接 SQL contract 覆盖。TypeScript unit contract 覆盖应用层 full runtime 的 senior 创建分支，但 `zhudatuan_operator_invitation_registration_contract.sql` 不含 senior role/predicate 的断言，不能证明 RLS/trigger 在真实 PostgreSQL role 与 session variable 下同样拒绝越权或允许合法路径。

## 未验证项

- 未在隔离 PostgreSQL 中以 Owner、Senior Administrator、普通管理员及匿名 registration role 执行 create/read/revoke/consume 反事实矩阵。
- 未验证后续 node-mall invitation migration 对本约束的覆盖范围；其属于后续独立 AU。

## 结论等级

- 新增问题：P3 1 项（F-0268）。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：F-0268 不需要独立复核；涉及实际授权策略发布时由权限所有者确认测试矩阵。
