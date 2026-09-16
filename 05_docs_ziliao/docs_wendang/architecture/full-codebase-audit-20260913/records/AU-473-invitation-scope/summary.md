# AU-473｜邀请资源范围解析

- 主审 `20260821066000_resolve_invitation_scope.sql`（80 行），并人工反查 identity invitation handler、后续 `access.resource_scope` 重定义和 `access.resolve_scope` 的 scope-hint 演进；未执行迁移、数据库查询或线上验证。
- 迁移以 `SECURITY DEFINER` 的 `access.resource_scope(operation, resource, membership)` 建立统一资源归属解析。它令 invitation create 归属发起 membership 的组织，revoke 归属被邀请记录的组织；未知资源一律以 `RESOURCE_SCOPE_NOT_FOUND` 失败，并只向 `shopapp` 授予 execute。
- 同一函数还解析跨域业务对象的 scope，因此是 Authorization Pipeline 在 handler 前的数据库边界。后续迁移持续重定义该三参函数，并以四参 `access.resolve_scope` 对 create 增加 scope-hint 优先；这证明当前实现已演进，不证明 AU-473 历史步骤可删除或单独回放。
- **G0**：邀请 create/revoke 的组织边界和大量资源的 fail-closed 解析均以该函数演进链为前提。**GX-0030**：动态定义的身份/授权 scope resolver，禁止删除、改写、跳过或单独重放；需独立复核当前 function definition、role grant、scope-hint precedence 和异常输入的 fail-closed 行为。未发现新增 P0–P3；未验证实际数据库函数头、RLS 或跨组织反事实请求。
