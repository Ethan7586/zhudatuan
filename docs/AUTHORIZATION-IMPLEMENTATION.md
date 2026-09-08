# 授权实现

授权唯一入口是 `packages/authz` 合同与 `services/commerce/src/pipeline/AccessPipeline.ts`。每个受保护 Operation 都按以下顺序处理：

```text
HostOnly Secure Session → Membership 状态 → Access Version → Resource Scope
→ Capability/Permission → StepUp → Risk → Decision Audit → Handler
```

- 客户端的 Tenant、Enterprise、Mall、Role、Permission 与 Scope 声明一律不可信。
- `ResourceScopeResolver` 由资源归属解析真实 Scope；跨 Scope 请求失败关闭。
- Deny 优先；权限、能力或会员版本变更后旧会话立即失效。
- 高风险写命令要求短期 StepUp，并同时写访问决策和业务操作审计。
- Console、Store、Supplier、Storefront 与 Miniapp 使用各自 HostOnly Cookie/Token 边界；Auth 不创建跨域共享 Cookie。
- 数据库 Role 只允许 `shopapp`、`shopjob`、`shopmigration` 和最小只读角色，浏览器不持有 Service Role。

授权测试覆盖跨租户、跨商城、失效版本、显式拒绝、高风险 StepUp、资源 Scope、RLS 和审计。任何测试账号、调试绕过或角色字符串推断均不得进入生产依赖图。
