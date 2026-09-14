# AU-462｜微信支付应用隔离

- 主审 `20260821055000_isolate_wechat_payment_applications.sql`（19 行），并人工反查支付创建、Webhook、查询/退款任务；未执行支付、Webhook 或线上查询。
- 迁移给 payment attempt 加入 `miniapp`/`jsapi` 场景和 AppID 的 SHA-256（不存明文）。活跃尝试必须同时绑定二者；已终态失败/成功记录可保留空值，兼容历史。
- 支付创建写入绑定，Webhook 从渠道观测中取 application hash 并与 attempt 核验，异步支付任务读取相同字段；索引服务于按应用追踪 intent。
- **G0**：实际支付与回调路径使用它。**GX-0021**：资金渠道应用隔离，禁止删除、改写或单独重放。未发现新增 P0–P3；未验证真实渠道回调、错 AppID 拒绝和恢复演练。
