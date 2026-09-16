# AU-048｜support 工单、消息与 SLA 异步链深审

- Console `support/:caseId?` 读取工单、消息并保留 cursor；发送时携带工单 version。
- 服务端消息发送以 `ticket.version` 加锁，消息、工单/会话版本、history 和 outbox 在同一操作事务内写入；附件转入 `supportscan`，SLA/扫描作业均已注册。
- [P2][F-0142] SDK/OpenAPI 将 `support.messages.send` 公开为 `expectedVersion: optional`，但 `SendMessage.prepare` 缺失该字段即抛 `EXPECTED_VERSION_REQUIRED`。前端当前总是携带版本，外部或旧调用方则会得到与契约不符的错误。
- 未发现 P0。正式测试未运行：固定审计工作树缺 package-local Vitest，未安装依赖。
