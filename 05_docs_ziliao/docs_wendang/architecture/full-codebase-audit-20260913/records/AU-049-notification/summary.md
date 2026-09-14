# AU-049｜notification 通知派发、偏好与渠道深审

- 运行入口：`NotificationModule` 由 Commerce 模块表装配；`app/jobs.ts` 注册 `notification` Worker（并发 32、15 秒 deadline、8 次退避重试）。Console 仅提供模板/公告的只读分页页面，发布写入边界明确保持关闭。
- 主链：业务 outbox/inbox 事件 → `DispatchNotification.event` → `notification.dispatch` 与 `runtime.job` 同一 SQL CTE 入队 → JobRunner → `DispatchNotification.dispatch` → SMS/邮件/微信/站内渠道 → dispatch attempt/outbox receipt。收件地址由 KMS 信封加密，模板只选择声明变量；微信订阅额外检查已接受授权。
- [P1 候选][F-0143] `dispatch` 在调用 KMS 解密或组装渠道请求前，已将 dispatch 从 `queued/failed` 置为 `sending`；这些前置操作的异常不执行 `repository.fail`。JobRunner 会重试 runtime.job，但重试时 `claim` 仅接受 `queued/failed`，因取不到 dispatch 而返回成功，随后将 job 标为 completed。该通知会永久停在 `sending`，且不会有 delivery attempt。等待 AU-050 独立复核后定级。
- 质量边界：现有身份挑战测试覆盖其单独的 ambiguous/fail 状态机，但没有覆盖一般通知 dispatch 的“claim 后、send 前失败”恢复。定向 Vitest 正式入口因固定审计工作树缺 `vitest` 命令而未启动；未安装依赖。
- 未发现 P0；未修改生产、测试、配置、迁移、依赖或线上状态。
