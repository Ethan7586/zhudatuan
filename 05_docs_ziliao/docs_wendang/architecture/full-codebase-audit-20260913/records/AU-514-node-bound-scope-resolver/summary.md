# AU-514｜NodeBoundScopeResolver 节点作用域门

- 审阅范围：`01_core_hexin/services/commerce/src/foundation/security/NodeBoundScopeResolver.ts`（26 行）及同名 test（38 行）；定向追踪 Catalog Operator 与 Web Business API runtime 注入。
- 审阅方式：逐段人工阅读与静态调用检索；未运行 API 或数据库。

## 真实运行关系

Catalog Operator/Web Business API runtime 将通用 scope resolver 包装为 node-bound resolver。每个 operation 先按正常身份/权限解析 scope；非 owner scope 必须等于 manifest/node mall scope，owner scope 则再次通过 server-side owner-to-mall resolver 映射验证，失败统一 `NODE_SCOPE_MISMATCH`。

## 审计结论

- **G0**：测试覆盖精确 node scope、owner scope 的二次映射、跨 node membership scope、跨 mall owner scope 与缺 resolver 的 fail-closed 行为。此组件是多 node API 防止合法全局/owner scope 漂移到错误 mall 的运行边界。
- 返回原始授权 scope（不是 node scope replacement）保持后续 permission/scope 语义；node scope 仅作为额外约束。未见静态绕过该 wrapper 的同一 runtime 注入路径。

## 未验证项

- `PgScopeResolver` 与 owner mapping 的实际 SQL/RLS、host header→node manifest 绑定和跨节点并发请求未执行验证。
