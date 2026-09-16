# AU-612｜Business Runtime 角色矩阵

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260830104000_business_runtime_role_matrix.sql`（160 行）。
- 审阅方式：逐行人工审阅 head guard、security-definer projections、session/actor binding、ACL/RLS 回收和 assertion；交叉检查 WebBusiness/Purchase runtime compatibility 与后续 runtime grants。未连接数据库或执行迁移。

## 审计结论

- **G0：保留。** 此 migration 是 Web/Purchase API 对身份与成员权威数据的最小访问边界，不能删除。
- [FACT][E-AU-612-001] `access.web_member_context` 仅允许 `zhudatuanwebapi`，要求 app membership 与入参一致，并以 live session、actor、credential/access version 与 active principal/profile 重验后返回必要 profile/membership projection。
- [FACT][E-AU-612-002] `access.business_membership_ancestor_scopes` 仅允许 Web/Purchase 登录身份、当前 app membership 和 actor-associated active member，返回组织 ancestor ID 而不暴露 authority row；Web 可用于自身 session，Purchase 限 storefront membership。
- [FACT][E-AU-612-003] 迁移撤销两个业务 API 对 identity/access/member 权威表和 member schema 的直接 privilege/RLS policy，仅授予两项窄函数；assert 覆盖 role attributes/membership、全部 DML/SELECT 权限、function ACL 与遗留 policy 清除。
- [FACT][E-AU-612-004] WebBusiness/Purchase runtime compatibility 分别要求专用登录 role、selected reads/writes 和 forbidden privilege boundary；本 migration 以 exact predecessor/future-head guard 纳入同一启动契约。

## 未验证项

- 未以两个实际 database role 验证 direct-table deny、函数内 session/actor mismatch、Purchase 非-storefront membership 拒绝或 RLS 行为；线上 role grants 未验证。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；新增 business role access 时应优先扩展受 session binding 的最小 projection，而非恢复 authority-table grant。
