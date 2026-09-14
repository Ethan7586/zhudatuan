# AU-682｜Authoritative Owner Node Console Projection

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260911170000_project_authoritative_owner_to_node_console.sql`（164 行）。
- 审阅方式：深入审阅。核对 authoritative governance function、operator invitation predicate、后续 `resolve_governance` replacement、Console readiness、Identity membership-management consumer和现有静态 test；未重复审阅 Platform Owner 初始数据和全部 invitation lifecycle。

## 审计结论

- **G0：保留。** 该 migration 将平台权威 Owner 的 principal 身份投影至其独立 node/operator membership，同时严格保留 `is_exact_owner`；其目的不是复制 Owner membership 或绕过现有 governance resolver。
- [FACT][E-AU-682-001] `resolve_authoritative_governance` 先调用当前 `resolve_governance`，仅在 actor membership 属于 `operator` 且 active authoritative Owner 的 principal 与 actor principal 一致时，将 governance level 投影为 owner；输出仍使用 base resolver 的 `is_exact_owner`，因此 node membership 不会获得 exact-owner 身份。
- [FACT][E-AU-682-002] 后续 `20260913015500` 虽重建了 base `resolve_governance` 的 senior/administrator logic，但没有替换 `resolve_authoritative_governance`；当前 `PgGovernanceResolver`、Identity membership target lookup和 Console readiness 仍以该 wrapper 为运行依赖。
- [FACT][E-AU-682-003] operator invitation predicate只允许 shopapp/Identity API、合法 tenant 或 exact-owner platform boundary、Owner/Senior role、有效 permission 且无 active deny override；不把任意同 principal membership 当作 exact owner。
- 现有 `GovernanceResolver.test` 通过 mock resolver row 与 migration source-string assertions 保存了 projection 意图，但不执行 PostgreSQL function/RLS predicate。此测试缺口已纳入 **F-0268** 的 invitation database authorization matrix，不新增重复问题。

## 未验证项

- 未以实际 `shopapp`、`zhudatuanidentityapi` 和无权限 role 在隔离 PostgreSQL 重放 Owner node membership、Senior、deny override与跨 tenant request 矩阵。
- 未读取生产 platformowner singleton、operator membership 和 role assignment，不能断言任意线上用户已实际使用该投影。

## 结论等级

- 新增问题：无；关联既有 F-0268（数据库授权矩阵缺口）。无 P0。
- 垃圾代码：G0 1 项（authoritative Owner node-console governance projection）；不新增 G1/G2/G3/GX。
- 二次复核：否；运行修复设计中应与 F-0268 一起复核。
