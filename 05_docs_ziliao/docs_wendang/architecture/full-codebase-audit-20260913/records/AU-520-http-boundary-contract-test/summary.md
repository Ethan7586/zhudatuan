# AU-520｜HTTP boundary contract 测试

- 审阅范围：`01_core_hexin/services/commerce/tests/http/Contract.test.ts`（64 行）；定向对照 RouteRegistry、HttpApp 与其更细粒度 unit tests。
- 审阅方式：逐段人工阅读；未启动真实 HTTP server。

## 审计结论

- **G0**：该 test 将 OperationCatalog 的全部 operation 注册进冻结路由表，验证跨 operation 通用 HTTP 边界：不可信 Origin 在 handler 前拒绝、无效 JSON 不到 handler 且保留 caller request ID、cookie-authenticated 写操作 CSRF 失败时清除 identity/csrf cookie、成功请求带 CSP/HSTS/CORS 头。
- 这不是完整 API contract/version compatibility 测试；`x-contract-version` 在此仅作为请求背景。实际 version 语义由 HttpApp 的专属测试覆盖，不能从本文件命名推断所有契约版本都被验证。

## 未验证项

- mock handler 无法证明真实 route operation、认证、中间件、浏览器 cookie/CORS 或 TLS 部署行为；无证据支持运行时验证已完成。
