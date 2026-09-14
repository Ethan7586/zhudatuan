# AU-508｜AccessPipeline 授权链路测试

- 审阅范围：`01_core_hexin/services/commerce/src/foundation/security/AccessPipeline.test.ts`（245 行）；定向对照 `AccessPipeline.ts`、`HttpApp.ts`、operation route 注册与 authorizer adapter。
- 审阅方式：逐段人工阅读测试和授权实现；未执行测试、HTTP 服务或数据库。

## 真实运行关系

HTTP route → OperationController/PipelineAuthorizer → AccessPipeline：session → audience target → feature declaration → membership/context/version → permission/scope → capability → resource readiness → assurance/risk/action proof → decision audit → handler。失败路径向 decision sink 记录 deny/challenge/review，之后不调用业务 handler。

## 审计结论

- **G0**：测试覆盖 operator operation 对 storefront/store/supplier credential 的 handler 前拒绝，console 正常放行，以及 membership identity、五个独立授权维度和 resource probe 顺序。这些是实际授权语义，不是冗余 mock。
- 32 组合的 fail-closed 测试将 feature、permission、scope、capability、resource readiness 联合验证；首个未满足维度的审计记录也受测。
- 目录创建测试刻意让 request body 写入另一 mall，但断言 handler 接收的 access mall context 来自授权 scope，而不是 body。这保留了“输入声明不等于授权边界”的回归契约，结论 **G0**。

## 未验证项

- fixture mock 了 session、membership、scope、risk、decision sink，故不能证明 PostgreSQL/RLS 或真实 HTTP middleware 在生产中的同等行为。
- 本测试不覆盖 action proof 的数据库消费；该已有 F-0243 覆盖，不能从本测试推断已修复。
