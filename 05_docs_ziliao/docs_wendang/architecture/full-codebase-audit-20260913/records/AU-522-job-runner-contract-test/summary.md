# AU-522｜通用 JobRunner 停止、重试与死信测试

- 审阅范围：`01_core_hexin/services/commerce/tests/job/Job.test.ts`（71 行）；复核已审 JobRunner、QueueJob、节点 scoped runner test 和多个 job processor 的 abort 行为。
- 审阅方式：逐段人工阅读与静态追踪；未运行队列/数据库。

## 真实运行关系

Jobs runtime → QueueJob → JobRunner claim（generic、identity-specialized 或 node-scoped）→ processor 获得由全局 stop signal 派生的 deadline signal → complete；任何 throw 进入 transaction fail：retry 或 terminal deadletter。多个实际 processor 在 `signal.aborted` 时 `throw signal.reason`。

## 审计结论

- **F-0251（P2，高置信）**：全局 SIGINT/SIGTERM/worker stop 中止会传给 in-flight processor；processor 抛出中止后，JobRunner 的通用 catch 无条件执行 `fail`，递增尝试并 requeue，达到 attempts 后死信。测试只在 processor 正常返回后 abort，未覆盖 processor 因 stop signal throw 的路径。重复滚动重启可能错误消耗 attempts，甚至将未完成任务标为 failed/deadletter。
- **G0**：lease-owner guarded completion、retry/terminal failure 的单 transaction 以及 deadletter upsert 均是实际恢复机制；不能因发现 stop 语义问题而删除 runner 或降低已有 F-0143 的独立 notification 状态机问题。

## 未验证项

- 未验证 Database function/lease、Deadline implementation、各 processor 是否确实中断 I/O、实际 worker shutdown grace period 或生产重启频率；风险是静态高置信路径，不宣称线上已发生。
