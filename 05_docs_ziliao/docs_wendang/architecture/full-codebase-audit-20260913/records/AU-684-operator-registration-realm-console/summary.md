# AU-684｜Operator Registration Bound to Realm Console

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260911190000_bind_operator_registration_to_realm_console.sql`（251 行）。
- 审阅方式：深入审阅。核对 registration write trigger、membership/role/scopegrant RLS、Realm target prerequisite、Identity registration runtime与后续 runtime reconciliation；未重复审阅一般 storefront self-registration。

## 审计结论

- **G0：保留。** 该 migration 将 operator invitation 的 tenant 管理权、node Mall membership、Realm console target 与最小 scope grants 原子地绑定，阻止 Identity registration role 直接制造脱离 invitation/Realm 的 operator access。
- [FACT][E-AU-684-001] trigger 只约束实际 Identity API session/role；对 operator candidate 要求已消费的单次手机号绑定 invitation、Mall 与 invitation storefront 一致、Mall 位于 invite tenant 下，并存在 `(realm, console, admin, operator, mall)` 的 realmtarget。
- [FACT][E-AU-684-002] RLS 分别将 membership、role assignment 和 scopegrant 限定为同一 console target；operator 只允许 self 与 invitation tenant scope，role 只允许 `role:self` 和 pending/Senior operator role，避免以 registration 流程获得任意 Mall/tenant grant。
- [FACT][E-AU-684-003] 后续 `20260912180000_reconcile_identity_runtime_state.sql` 将此版本作为已核验 production runtime object 的 reconciliation marker，未替换其 trigger/policy。未发现后续 migration 对该 function 的再次 `create or replace`。
- **F-0280：P3。** repository 中没有该 migration 的 PostgreSQL execution contract；现有 Identity registration tests 为 application/mocked database test，不能验证 trigger 的 `session_user/current role`、RLS、transaction-time invite consume和 Realm target 反事实。

## 未验证项

- 未以隔离数据库用正式 migration runner 重放新 operator、wrong Realm、wrong console target、wrong Mall、expired/replayed invite、超范围 scopegrant 与非 Identity API role 的 allow/deny matrix。
- 未读取生产 `identity.realmtarget`/invite/membership 数据，不能断言已部署 Realm 全部满足 prerequisite。

## 结论等级

- 新增问题：F-0280（P3，高置信度）。无 P0。
- 垃圾代码：G0 1 项（Realm-bound operator registration boundary）；不新增 G1/G2/G3/GX。
- 二次复核：否；后续数据库契约测试批次应覆盖。
