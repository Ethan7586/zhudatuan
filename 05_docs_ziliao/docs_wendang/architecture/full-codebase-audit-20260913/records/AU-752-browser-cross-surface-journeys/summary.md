# AU-752｜浏览器跨页面旅程与订单只读预览

- 审阅范围：Finance Playwright config、OrderManagement spec、WebJourneys spec。
- 审阅方式：深入审阅每个 spec 的页面入口、mock route、写入/失败断言与 WCAG 复用；config 结构性审阅。未运行浏览器或服务。

## 审计结论

- **G0：三文件均为有效测试入口/规格。** Finance config 启动固定 loopback Console；OrderManagement 验证服务端筛选/selected URL/异常展示以及预览动作不写入；WebJourneys 覆盖 Auth PKCE 请求形状、Console/Store/Supplier/Storefront 深链和 WCAG。
- 全部业务 API 或 health 响应均由 OperationMock/Playwright route/fixture 提供。它们可发现 UI 误发写请求、路由或可访问性回归，但不能证明真实订单、支付、恢复、身份授权或运行健康已通过。
