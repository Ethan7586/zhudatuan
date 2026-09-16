# AU-750｜浏览器 preview 分页与工作台契约

- 审阅范围：Finance/Order/Product/Referral/Voucher preview fixtures，以及 Finance/Product workspace、Order/Product pagination 代表性规格。
- 审阅方式：深入核对三类大 fixture 的 query/cursor/limit/error 逻辑和两条分页竞争规格；Finance workspace、Referral/Voucher 与同构规格做结构性覆盖。未启动 Playwright 或 preview server。

## 审计结论

- **G0：fixtures 是 Console preview server 的确定性输入。** Finance/Order/Product 以 query fingerprint 绑定 base64url cursor，并对非法 cursor/limit 抛稳定 preview error；Referral/Voucher 是相同 preview 面的静态资源。
- 代表性规格验证服务端分页、单页 DOM、`x-scope-hint`/`x-access-version` 和延迟旧请求不覆盖最新 URL 查询。它们有效约束前端读取行为，但均经 OperationMock/preview payload，不证明真实读模型、数据库性能或权限执行。
