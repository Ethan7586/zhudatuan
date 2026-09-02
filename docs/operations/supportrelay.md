# Support 实时事件中继

- Trigger：Redis 不可用、连续重试、Outbox 最老未投递事件超过 60 秒或游标写回失败。
- Impact：HTTP 业务写入仍由 PostgreSQL 可靠提交，但在线客户端会延迟收到客服事实事件。
- Owner：Support on-call 负责事件正确性，Runtime on-call 负责 Redis 和工作负载。
- Stop loss：保留 Outbox 与任务租约，必要时限制新 SSE 连接；不得跳过事件、伪造游标或提前标记完成。
- Diagnosis：检查 `runtime.outbox.realtime_error`、Job 租约、Redis 主从状态、Stream 保留窗口、事件目录版本和积压年龄。
- Recovery：恢复 Redis 后按原事件 ID 重试；只有发布成功并在短事务中保存 Redis 游标后才标记实时投递完成。
- Data repair：从 PostgreSQL Outbox 重放未完成事件；客户端游标过期时返回 410 并执行权威数据重同步。
- Validation：核对事件 ID、scope、工单、会话、Sequence、Version，确认无正文或成员标识泄露、无重复副作用且积压归零。
- Escalation：无法在十五分钟 RTO 内恢复、跨 scope 事件或 Outbox 缺失时立即升级 Reliability 与 Security incident commander。
- Audit：归档请求链路、事件 ID、重试次数、Redis 游标、恢复时间、验证结果和操作人。
- Postmortem：记录故障域、容量与保留窗口是否充足，并形成 owner/action/date 的改进项。
