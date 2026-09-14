# AU-588｜Storefront Compatibility 会员授权基础迁移

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260809093000_membership_authorization_foundation.sql`（261 行）。
- 审阅方式：逐段人工审阅 member/membership/scope/role模型、scope validators、authz-version triggers、回填、audit evidence与 context resolver；定向比对现行 Commerce API session resolver及 later runtime cutover/permission models。未执行 migration或身份 RPC。

## 审计结论

- **G0**：这是 membership authorization 的根迁移，生产运行单元已声明 `AUTH_MODE=membership`，不能删除。
- [FACT][E-AU-588-001] members/memberships/scopes/roles 表以 FK/RLS/revoked/expiry/status约束身份事实；scope trigger拒绝租户外 resource，scope/role/status/expiry变更递增 `authz_version`，使会话可检测授权失效；audit logs保存 membership/granted-via证据。
- [FACT][E-AU-588-002] 迁移把 legacy employee/mall_admin 回填为 storefront/admin membership，分别建立 self/mall scope和 role；`api_resolve_membership_context` 仅返回 active、未过期 member/membership 的 server-derived roles、permissions、context、scope bindings和版本，execute仅service_role。
- [FACT][E-AU-588-003] Commerce API 现行请求路径使用更后的 `api_resolve_session_membership_context`，而 development fixture可使用本 resolver；later runtime cutover、permission command center、security center/organization hierarchy继续重定义或复用该基础。不得用初版函数文本代替固定基线最终 resolver。
- Compatibility 与 Canonical 同名 migration SHA-256 一致，且两者 ledger/data 仍隔离。

## 未验证项

- 未执行 cross-tenant scope、role revoke、expiry、authz-version/session invalidation、backfill幂等或真实 RLS privilege反事实；当前只以静态部署配置证明 membership mode被声明，不能证明线上实际生效。
- 初版 scope validator仅保证资源在同一 tenant，跨 enterprise/mall delegation语义由 later command center/organization hierarchy共同定义；本单元未把初版最小边界误写为完整最终授权模型。
