# AU-689｜SFL Multi-Realm Membership and Session Resolution

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260912030000_create_sfl_multi_realm_membership.sql`（182 行）。
- 审阅方式：深入审阅。核对 Realm containment、member target projection、session resolver、Identity login/ticket/registration consumers、后续 ownership/grant reconciliation和 multi-Realm SQL contract；未重复审阅单 Realm session basics。

## 审计结论

- **G0：保留。** module 是 hosted member Realm 通过其 registration host entry Realm 登录、同时保持 account/membership/session Realm isolation 的核心边界。
- [FACT][E-AU-689-001] `realm_contains_account_realm` 只允许 active account Realm 等于 active entry Realm，或具备以该 entry Realm node为 host的 member-registration fact；不是按 hostname/string wildcard 推断。
- [FACT][E-AU-689-002] registration trigger从 host Realm的 consumer realmtarget复制到新的 member Realm；session resolver同时验证 session/account/membership Realm一致、entry host→Realm、target client+organization、credential/access version和 active membership context。
- [FACT][E-AU-689-003] Identity Registration/SMS/PgAuthTicket/RealmAccount consumer都调用 containment或 active-membership resolver。`sfl_multi_realm_membership_contract.sql` 执行两条 member line及 operator line、cross-host session rejection、session revoke/switch、suspended membership rejection和 realm-scoped permission/asset residue checks。
- 后续 reconciliation/restore migrations只调整 function owner/execute privilege并保留 public deny，不替换该语义。

## 未验证项

- 未读取生产 host→entry Realm map和成员 registration facts，无法确认历史数据的 target projection完整性。
- 未运行 contract，未对真实 browser host/redirect path做只读验证。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（multi-Realm containment/target projection/session boundary）；不新增 G1/G2/G3/GX。
- 二次复核：否。
