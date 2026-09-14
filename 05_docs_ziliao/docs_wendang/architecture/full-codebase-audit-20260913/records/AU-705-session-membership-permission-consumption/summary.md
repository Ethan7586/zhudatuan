# AU-705｜Session Membership Permission Consumption

- 审阅范围：`20260912240000_bind_permission_reads_to_session_membership.sql`、`PgAccessResolvers`、Identity registration runtime 与 PostgreSQL 17 permission-consumption fixture/contract。
- 审阅方式：深入审阅 session→membership→realm/client/organization four-part binding、membership/version/scope/operation读取和调用适配；同构 resolver方法按共享 contract结构性审阅。

## 审计结论

- **G0：保留。** 迁移将 session解析扩展为 membership client与治理 organization，并以 `session_membership_context_matches` 作为 permission、access-version、scope和capability read的统一门卫；读侧不能再仅凭 membership id获取跨 Realm/organization的权限结果。
- [FACT][E-AU-705-001] `PgMembershipResolver`、`PgAccessVersionResolver`、`PgScopeResolver`和`PgCapabilityResolver`均要求 `MembershipConsumptionContext`，并调用对应带 `(membership, realm, client, organization)` 参数的数据库函数；缺 context立即失败。
- [FACT][E-AU-705-002] 定向 `npm run check:session-membership-permission-consumption` 已通过 PostgreSQL 17 验收，覆盖 operator/storefront 隔离、跨 Realm/organization拒绝、inactive membership拒绝、本人权限成功和只读性。

## 未验证项

- 未读取生产 connection-pool role inheritance、session host/target来源与完整 API end-to-end response；未声称线上所有旧 consumer均已迁移。
- 本批未全量运行其它 migration/contracts，遵守定向验证纪律。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项；不新增 G1/G2/G3/GX。
- 二次复核：不要求新增独立复核；若改 session schema、resolver调用或runtime role，必须重跑同一 PG17 matrix并增加真实 API session refresh/revocation验证。
