# Deadletter 运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

任一 required Job/Event 进入 Deadletter、未在 Owner SLA 内认领、重复进入、数量/年龄越界或无可执行 Runbook 时触发。派生任务延迟为 P1/P2；交易事实、支付、库存、凭证或账务无法推进为 P0/P1。Deadletter 永不自动丢弃或无限自动重放。

## Owner 与前置权限

Runtime Owner 负责队列，Job Catalog 或 Event Catalog 的业务 Owner 对处理结果负责。只读诊断需要 Deadletter、原任务/事件、Checkpoint、Inbox/Outbox 与审计权限；重放、补偿或隔离需要对应 Owner 和高风险动作 Proof。处理人与高风险审批人必须职责分离。

## 只读诊断（Diagnosis）

按 `{environment}`、`{deadletterId}`、`{owner}` 读取原始不可变 Payload Hash、Schema 版本、Scope、失败代码、尝试时间线、最后 Checkpoint、幂等键、租约 Token、关联收据和业务事实。确认错误是否可恢复、配置/代码是否已修复、外部结果是否 Unknown，以及同输入是否已有成功结果。

## 止血（Stop loss）

阻止该错误类的新自动重放；必要时暂停同 Kind/分区并隔离恶意或不兼容 Payload。保留其他队列吞吐。外部调用未知时只查询，不重复提交；不得删除 Deadletter、修改 Payload、清零尝试次数或直接标成功。

## 恢复（Recovery）

先 Dry-run 重放：验证 Schema、Scope、授权快照策略、幂等结果、Checkpoint 和预期副作用，输出输入 Hash 与计划。审批后以原业务 ID、EventId、Idempotency Key 和 CorrelationId 建立一次受控 Replay，新的执行记录引用 Deadletter；从最后已提交 Checkpoint 继续。不可恢复错误转人工补偿/前向修复并保留原记录。

## 数据核对（Data repair / Validation / Escalation / Audit）

比较 Dry-run 与实际输入 Hash、Checkpoint、执行次数、业务收据、Outbox/Inbox 和聚合版本；证明没有重复扣款、预占、发券、核销、入账、通知或 Provider 下单。确认下游 required 消费者水位、金额/数量守恒、Scope 隔离和审计链完整。

## 回滚边界

未执行 Replay 可取消；已执行 Replay 不删除，副作用不能靠回退队列撤销，只能领域补偿/冲正。原 Deadletter 在处理结论、核对和证据保留期结束前不可删除。

## 沟通模板

“Deadletter `{deadletterId}`，严重级 `{severity}`，Owner `{owner}`，Kind `{kind}`，失败代码 `{errorCode}`，用户影响 `{impact}`，当前处置 `{containment}`，计划 `{replayOrRepair}`，下一更新时间 `{nextUpdate}`，证据 `{evidenceRef}`。”

## 关闭条件

业务 Owner 已认领；错误根因已修复或隔离；Replay/补偿完成；所有守恒、幂等、Scope 和下游水位核对通过；告警恢复；原记录、审批与证据按保留策略归档。

## 复盘链接（Postmortem）

P0/P1、重复效果、无人认领、错误自动重放或同类重复发生必须填写 `{postmortemUrl}`，记录分类、SLA、根因、修复、验证和自动化改进。
