# AU-711｜邀请 Hint 与 Storefront Browse Scope

- 审阅范围：`20260905012000_honor_invitation_scope_hint.sql`、`20260905013000_registration_invite_role_projection.sql`、`20260905014000_bind_storefront_browse_scope.sql` 及 session-bound scope consumption链。
- 审阅方式：深入审阅 scope resolver分支、registration invite角色白名单、Storefront catalog/pricing/inventory read的 Mall pinning；同构历史 resolver覆盖作结构性审阅。

## 审计结论

- **G0：保留。** 050120使新建 invitation可解析显式目标 scope；它只返回操作资源 scope，不单独绕过 capability/scope authorization。后续 session-bound resolver（AU-705）将 membership、Realm、client、organization绑定到该读路径。
- [FACT][E-AU-711-001] 050130严格限定注册 invite：Storefront只能使用目标 Mall标准 member role；operator只能使用无 permissions的 pending role或目标 scope的 senior-administrator role，且 execute不向 public开放。
- [FACT][E-AU-711-002] 050140将 Storefront active membership的 catalog/pricing/inventory browse scope固定为自己的 active Mall；foreign hint不产生 scope。后续业务授权仍由 operation capability和当前 session context完成。
- 本模块没有新增独立问题。

## 未验证项

- 未以真实 API role、两个 Mall和实际 scope grants跑 invitation/browse HTTP matrix；未读取生产 grants、Storefront sessions或 catalog visibility。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 组；不新增 G1/G2/G3/GX。
- 二次复核：不要求新增独立复核；改变 invitation scope hint或Storefront browse operations时，必须验证同 Mall allow、foreign hint deny、pending operator role无操作权限及 session membership mismatch deny。
