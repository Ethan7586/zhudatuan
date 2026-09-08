# Outbox 运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

Outbox 最旧未发布时间或数量越过 SLO、Relay 租约冲突、发布失败、消费确认停滞、同事件重复效果或 Inbox 拒绝异常时触发。派生视图延迟为 P1；支付、库存、凭证、账务等跨边界事实丢失或重复生效为 P0。

## Owner 与前置权限

Runtime Owner 主责，Reliability、Database、消息平台和事件 Owner 协同。诊断需要 Outbox/Inbox、队列、租约和消费者水位只读权限；暂停分区和重放需要受审计执行权限及事件 Owner 批准。不得直接编辑事件 Payload、发布标记或消费者业务表。

## 只读诊断（Diagnosis）

按 `{environment}`、`{partition}`、`{eventId}`、`{consumer}` 读取最旧未发布时间、积压数、事务提交时间、事件 Schema/Hash、Relay 租约/Fencing、尝试次数、消息平台确认、Inbox Claim、消费者 Checkpoint 和 Deadletter。确认权威业务事务与 Outbox 在同一提交中，区分未发布、已发布未消费和已消费未投影。

## 止血（Stop loss）

暂停受影响分区的派生消费者或新 Relay Claim，保留在线权威事务与其他分区。队列容量紧张时先延迟导出、报表和同步，不能丢弃交易事件。隔离 Schema/Hash 异常事件；未知外部结果转领域查询恢复，禁止通过重复创建业务命令“补事件”。

## 恢复（Recovery）

Relay 以更高 Fencing Token 从未发布游标按原 EventId 重发；消费者先以 `consumer + eventId` Claim Inbox，再执行本地事务并提交 Checkpoint。已存在成功 Inbox 的事件只回读收据，不再次产生效果。Schema 不兼容通过版本化 Upcaster 或前向修复，禁止改历史 Payload。失败超过 Catalog 上限进入 Deadletter。

## 数据核对（Data repair / Validation / Escalation / Audit）

核对业务事务数与 Outbox 事件数、事件 ID/Hash、发布确认、每个 required 消费者 Inbox 与投影水位；重复投递后订单、库存、支付、凭证、账务、通知效果不增加。检查无间隙、无越序破坏、无跨 Scope 消费，积压年龄和数量恢复目标。

## 回滚边界

可暂停/恢复 Relay 与消费者，可重放同一不可变事件；不得删除未消费 Outbox、回退 Checkpoint 或改成功 Inbox。错误事件的业务效果由领域补偿/冲正，新事件引用原 EventId/CorrelationId；历史事件永久保留原 Hash。

## 沟通模板

“Outbox 事件 `{incidentId}`，分区 `{partition}`，最旧积压 `{oldestAge}`，数量 `{depth}`，受影响消费者 `{consumers}`，用户影响 `{impact}`，止血 `{containment}`，下一水位 `{checkpoint}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

Relay 唯一租约与发布确认正常；所有 required 消费者水位追平；Deadletter 有结论；事件/Inbox/业务效果数量与 Hash 核对通过；重复效果为 0；告警恢复且证据归档。

## 复盘链接（Postmortem）

事件丢失、重复业务效果、跨 Scope、Schema 破坏或积压越过 SLO 必须填写 `{postmortemUrl}`，记录时间线、缺口区间、重放证据、容量与防复发措施。
