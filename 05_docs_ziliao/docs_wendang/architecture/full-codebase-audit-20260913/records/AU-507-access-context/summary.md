# AU-507｜AccessContext 运行上下文与节点绑定

- 审阅范围：`01_core_hexin/services/commerce/src/foundation/security/AccessContext.ts`（132 行）；定向追踪 `HttpApp.ts`、`NodeServer.ts`、`AccessPipeline.ts`、`PgAccessResolvers.ts` 与调用点。
- 审阅方式：逐段人工阅读及静态调用链检索；未启动 HTTP 服务、未连接数据库。

## 真实运行关系

HTTP/Node server 依 host 将已解析的 node context 绑定到每请求 headers object；`HttpApp` 把该对象传给 operation handler。session resolver 产生 actor，AccessPipeline 要求 realm/client/governance organization 后读取 membership、scope、capability 与 governance，最后形成 AccessContext。Pg scope resolver 将同一 node context 绑定到 resolved scope；业务操作再以 require helper fail-fast 获取 node/governance/membership consumption context。

## 审计结论

- **G0**：所有 context binder/require helper 均有实际职责。`bindRequestNodeContext`/`requestNodeContext` 由 HttpApp/NodeServer 使用；`bindScopeNodeContext`/`requireScopeNodeContext` 由 PgAccessResolvers 及其回归测试使用；membership/governance/node require helpers 是 AccessPipeline/identity/member 等业务操作的 fail-fast 边界。
- WeakMap 以请求 headers/scope 对象作为 identity key，避免将 node context 序列化或暴露给客户端 headers；在当前入口中 headers 对象在绑定后只作为同一请求的 handler 输入。未见静态证据表明该 context 跨请求复用。
- 类型中保留 legacy synthetic fixture 的 optional actor 字段，但 runtime pipeline 强制 membership consumption context；这不是删除依据。

## 未验证项

- 未执行并发 HTTP 请求，因此未验证实际框架是否以同一 headers object 贯穿所有非 health route；静态路径显示 HttpApp 和 NodeServer 均维持该对象。
- 未复核每一个 operation 是否都使用 node/scope context；该项属于后续各业务模块的权限链路审计。
