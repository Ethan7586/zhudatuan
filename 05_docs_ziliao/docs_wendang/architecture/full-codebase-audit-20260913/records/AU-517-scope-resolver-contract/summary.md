# AU-517｜ScopeResolver 作用域解析契约

- 审阅范围：`01_core_hexin/services/commerce/src/foundation/security/ScopeResolver.ts`（6 行）；定向追踪 AccessPipeline、Pg/WebBusiness/NodeBound implementations 与所有 API runtime 注入。
- 审阅方式：人工接口/调用链审阅；未执行 DB 或 HTTP。

## 审计结论

- **G0**：接口统一绑定 actor、operation、可选 resource 和 scope hint，是 AccessPipeline 将权限检查与数据库/节点/店铺作用域实现解耦的边界。PgScopeResolver、WebBusinessScopeResolver 和 NodeBoundScopeResolver 分别承担 canonical、storefront、节点隔离实现。
- 主要 API runtime 显式注入这三类实现；scope hint 被保留为输入以支持正式 scope selection，而不是调用方可直接提供的授权结果。

## 未验证项

- 每个实现的 SQL、RLS、scope hint 错误处理和跨节点行为由后续 resolver/业务模块单元验证；接口本身无可执行逻辑。
