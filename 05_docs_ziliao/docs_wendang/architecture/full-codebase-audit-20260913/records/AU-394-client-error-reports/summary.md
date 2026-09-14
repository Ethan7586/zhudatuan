# AU-394｜客户端错误回报

`20260819120000_client_error_reports.sql` 定义浏览器错误账本、受影响 membership 见证表和通知 outbox。错误以 surface/route/message 指纹去重，首次出现及达到阈值时才入队；通知载荷不含 stack，stack 与组件栈只保留在服务端。outbox 采用 `FOR UPDATE SKIP LOCKED` 租约、指数式重试与 dead-letter 状态。

固定基线未发现前端或 API 调用 `api_record_client_error`，也未发现 Worker 调用 claim/complete RPC、后续替代迁移或数据库契约测试。该缺口使整个观测与通知链不能由仓内证据确认在运行；但 service-role 接口、可能存在的仓外客户端/worker、历史错误和栈数据留存责任均未排除。

故登记为 DC-0058/G2，禁止删除并要求独立复核生产调用、outbox 状态、通知契约及敏感栈数据留存/清理政策。未发现 P0；未执行测试、数据库写入、构建或线上检查。
