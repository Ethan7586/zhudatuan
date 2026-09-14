# AU-607｜Scope Hint 与资源优先级

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260829217000_scope_hint_resource_precedence.sql`（141 行）。
- 审阅方式：逐行人工审阅 migration guard、四参 scope resolver、resource-owner precedence、ACL 和断言；交叉检查 `PgScopeResolver`、`AccessPipeline` 的 scope grant 复核、session-bound resolver、Aliyun registration ACL reconciliation、后续 invitation/storefront scope migration。未连接数据库或执行迁移。

## 审计结论

- **G0：保留。** 本 migration 为 scope resolver 建立“已有资源以存储 owner 为准、仅创建时可使用 canonical scope hint”的运行边界；不能因没有路由文件直接引用其 migration 文件而判定无用。
- [FACT][E-AU-607-001] migration 要求 AU-606 精确 predecessor 且拒绝 future head；四参 `access.resolve_scope` 仅对 `access.roles.manage`、`access.scopes.manage`、`invoice.profiles.manage` 定义新增资源的 hint 规则。已有 role/profile 忽略传入 hint，读取其存储 scope；未知资源且无 hint 返回空。
- [FACT][E-AU-607-002] 默认分支将 `resource` 或 `scope_hint` 交给旧三参 resolver，未替换其它既有资源映射。后续 invitation 与 storefront migration 在同一函数上扩展明确的 operation 分支，表明它是持续维护的授权契约而非过渡副本。
- [FACT][E-AU-607-003] 真实 API 调用链为 `PgScopeResolver` → `access.resolve_session_scope` → 四参 resolver；`AccessPipeline` 随后以 `checkScope(membership, permission, scope)` 对当前 membership grant 和 permission 复核，并另检查 capability、resource readiness、session realm/client/organization。因此 resolver 提供 scope hint 不单独构成授权。
- [FACT][E-AU-607-004] 函数撤销 public execute，只授权 shopapp、identity/web/purchase API；Aliyun registration reconciliation 和后续 Console/Provisioning migration 维护额外受控角色 ACL。migration assert 覆盖缺失 role/profile、普通 fallback、existing role precedence 和 ACL。

## 未验证项

- 未在真实数据库执行跨范围 role/profile 的操纵、创建时 scope grant 反事实拒绝、ACL/RLS 拒绝或完整 HTTP 授权链；线上历史 role/profile owner 数据和 migration 顺序未验证。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；后续新增接受 `x-scope-hint` 的 operation，必须同时验证已有资源优先级、session membership binding 与 `checkScope` 的 grant 反事实。
