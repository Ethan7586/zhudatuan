# AU-050｜F-0143 通知投递状态机独立复核

结论一致：F-0143 定级为 **P1，高置信度**。

本轮从与 AU-049 不同的证据方向起步：PostgreSQL `runtime.claim_job`、notification 生命周期迁移、JobRunner 测试与 identity 的专用积压监控。`runtime.claim_job` 只领取 queued 作业；notification.dispatch 的迁移和所有后续 migration 都没有 `sending` 回收/租约字段或恢复函数。普通 notification 没有 identitynotification 所拥有的 stale-running/delivery-alert 监测。

因此，`DispatchNotification.dispatch` 的前置 KMS 解密异常会让 runtime.job 正常退避、但遗留 notification.dispatch=sending；下一次 job 从 runtime 重新取得后，dispatch claim 返回空，processor 视为成功，runtime job 被标 completed。此后没有代码或迁移入口会再把该 dispatch 改回可领取状态。不是 P0：没有线上 KMS 失败、dispatch 存量或用户影响规模的观察证据。

未修改代码或数据；未运行数据库或线上操作；正式 Vitest 仍因固定工作树缺命令无法启动。
