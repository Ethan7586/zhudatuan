# AU-706｜Identity Execute 与高级管理员邀请投影

- 审阅范围：`20260913012500_restore_identity_context_resolver_execute.sql`、`20260913013500_restore_identity_session_owner_execute.sql`、`20260913015500_complete_senior_administrator_invitation_projection.sql`、身份邀请和 Access role assignment 实现。
- 审阅方式：两份同构 execute-grant 迁移作结构性审阅；深入审阅高级管理员治理等级、邀请角色选择、operator display-name projection和授予/撤销写入链。

## 审计结论

- **G0：保留。** 两份小迁移分别恢复 Identity API 与 migration runner 对 active membership context resolver的 execute，属已存在 security-definer contract的最小权限修复。
- [FACT][E-AU-706-001] 高级管理员只在 active operator membership持有以其治理组织为 scope、且该 scope覆盖 actor organization的正式 senior role时被投影为 `senior_administrator`；exact platform owner仍优先为 owner，普通 operator仅为 administrator。
- [FACT][E-AU-706-002] Invitation entry只允许 governance owner创建 senior-administrator invitation，角色ID由目标治理组织派生；Access role grant/revoke同时更新 `operator_display_name` 并提升 access version，避免旧会话继续使用陈旧权限。
- 本模块没有新增独立问题。display-name backfill只作用于 operator，运行时更新已有 null/旧值的兼容分支明确；未发现生产调用绕过 owner gate的证据。

## 未验证项

- 仓内没有该 130155 migration 的专用 PostgreSQL role/invitation acceptance runner；本轮未全量运行其他 governance test。
- 未读取生产 operator membershiprole、owner singleton或历史 invitation数据，未宣称 backfill已经覆盖线上旧名称。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 组；不新增 G1/G2/G3/GX。
- 二次复核：不要求新增独立复核；未来调整 senior role scope、owner transfer或 invitation API时，必须增加真实 PostgreSQL matrix，覆盖 owner allow、senior deny创建同级、cross-tenant deny、grant/revoke access-version失效和显示名回退。
