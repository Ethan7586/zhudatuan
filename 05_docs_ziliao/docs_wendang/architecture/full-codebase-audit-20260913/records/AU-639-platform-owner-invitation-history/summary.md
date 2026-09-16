# AU-639｜Platform Owner Invitation History

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260903101000_allow_platform_owner_invitation_history.sql`（70 行）。
- 审阅方式：对 AU-633 同构 invitation predicate 采用差异性深入审阅：核对 platform-owner branch、application scope setting、Member invitation records read path、前置/lock；不重复展开已覆盖 permission/deny predicate。未连接数据库或执行 migration。

## 审计结论

- **G0：保留。** migration 仅为 exact Owner 增加 platform scope 下跨其 organization subtree 的 operator invitation history 访问；Senior Administrator 仍只能在自身 tenant scope 行使 pending invitation 权限，无法借此扩大到 platform。
- [FACT][E-AU-639-001] 新增 branch 同时要求 exact Owner、`scope_kind='platform'`，且通过 `organization.unitclosure` 证明 request scope organization 是 invitation tenant 的 ancestor；其余 role、permission、deny override 与 create restrictions 保持 AU-633 定义。
- [FACT][E-AU-639-002] application 创建 operator invitation 时，platform scope 必须先确认目标 tenant 在 `access.scope_allowed` 内，再把 transaction `app.scope_id` 收窄至该 tenant；因此数据库 predicate 与 create path 的 effective scope 相容。
- [FACT][E-AU-639-003] AU-636 的 `member.invitations.read` action 使用 scope tree filter，Console/SDK/IdentityRegistrationApi 均已注册该入口；本 migration 的 predicate使 platform Owner 能读取该 tree 的 operator invitation history，而不暴露 invitation secrets。

## 未验证项

- 未在真实 PostgreSQL RLS 中验证 platform Owner allow、non-owner platform deny、Senior Administrator platform deny 和 cross-subtree deny；该数据库 invitation predicate 契约缺口已统一记录为 F-0268，不重复登记。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：不需要；沿用 F-0268 的数据库 role/session 反事实矩阵。
