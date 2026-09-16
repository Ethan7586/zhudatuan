# AU-518｜SessionResolver 会话与节点上下文契约

- 审阅范围：`01_core_hexin/services/commerce/src/foundation/security/SessionResolver.ts`（18 行）；定向追踪 PgSessionResolver、PurchaseSessionResolver、HttpApp node context 绑定与所有 API runtime 注入。
- 审阅方式：人工接口/调用链审阅；未执行认证数据库查询或 HTTP。

## 审计结论

- **G0**：SessionResolver 将已认证 actor 与 runtime node context actor 区分；`sessionNodeContext` 只从 server-bound request headers 获取 node context，缺失立即失败，避免 session resolver 从客户端字段推导 node。
- 所有主要 API runtime 使用 PgSessionResolver；Purchase API 再加 audience wrapper。AccessPipeline 的 session 首步依赖该接口，不能将其视为仅类型文件或删除。

## 未验证项

- bearer/cookie 解析、DB session lookup、realm/account/node consistency 与注销/刷新由 PgAccessResolvers 和身份模块后续复核；本接口不含实现。
