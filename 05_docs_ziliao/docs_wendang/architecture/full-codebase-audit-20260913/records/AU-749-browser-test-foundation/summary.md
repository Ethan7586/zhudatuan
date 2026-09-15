# AU-749｜浏览器测试共同底座

- 审阅范围：browser fixtures、loopback origins、WCAG helper、application preview fixture、Console/MVP preview server、server test 与 TypeScript config。
- 审阅方式：深入审阅 loopback/preview server 与其 test；其余共享 fixture/helper 按代表性结构审阅和 importer 反查。未启动浏览器、preview server 或安装依赖。

## 审计结论

- **G0：Origins/Accessibility/Fixtures/ApplicationPreview/ConsolePreviewServer 是多份浏览器规格的共享测试底座。** Origins 禁止非 loopback endpoint；Axe helper 用 WCAG 2.0/2.1/2.2 A/AA tags；Console preview server 有 readiness 超时和独立 server test。
- 这些规格大量通过 Playwright route/OperationMock 或固定 preview payload 验证页面行为，适合 UI 合约与无障碍回归，不能证明真实 API、数据库、权限或支付通路。
- **G1：`MvpServer.mjs` 暂不删除。** 固定基线未发现其它 browser source 对它的静态导入；但它可作为手动本地购买体验 fixture，且仓外命令/历史验收未排除。
