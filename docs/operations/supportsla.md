# 客服 SLA 运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

首次响应/解决 Deadline 越过、Escalation Lag 增长、定时任务停滞/Deadletter 或高优先级 Conversation 无 Owner 时触发。个别延迟为 P1/P2；大面积紧急会话无人处理或跨 Scope 升级为 P0/P1。

## Owner 与前置权限

Support Queue Supervisor 主责，Runtime、Notification 与业务支持负责人协同。SLA 以 Conversation 创建时冻结的策略版本、优先级和数据库时间为准；人工分配/升级需要 Scope 权限和原因。

## 只读诊断（Diagnosis）

核对 Conversation 状态/优先级、SLA Snapshot、Response/Resolution Deadline、Assignment/Agent 容量、Escalation Event、Notification Dispatch/Receipt、Job Lease/Fencing/Checkpoint 和数据库时钟。不得改时间或用当前策略重算历史截止时间。

## 止血（Stop loss）

用正式 Assign Operation 为紧急会话指定合法 Owner，保留自动分配证据；限制低优先级新分配但不阻断用户消息。禁止直接改 Deadline、覆盖历史或伪造已响应。

## 恢复（Recovery）

恢复 Scheduler/Notification 后以原 ConversationId 幂等重放；每个截止点最多一个 Escalation Event 和 Dispatch。无合法 Agent 时进入人工队列并升级 Manager，不自动关闭。错误策略仅影响新 Snapshot，历史通过批准的前向例外处理。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 证明所有 overdue Conversation 有一个升级、Owner 与通知回执，冻结策略/截止时间未改，首次响应/解决事实来自持久消息。Data repair 只追加 Assignment/SLA Exception；Escalation 紧急无人立即升级；Audit 保存策略、时间、Actor、Receipt。

## 回滚边界

未执行调度可取消；已发升级/通知不删除，可追加更正。历史 SLA 事实不可回写为达标。

## 沟通模板

“客服 SLA `{incidentId}`，Scope/队列 `{scope}/{queue}`，超时 `{count}`，最久 `{oldestAge}`，紧急影响 `{impact}`，人工 Owner `{manualOwner}`，证据 `{evidenceRef}`。”

## 关闭条件

所有 overdue 有 Owner/升级/回执；积压和最老时间回到 SLO；策略 Snapshot、数据库时间和持久历史核对通过；告警恢复。

## 复盘链接（Postmortem）

紧急遗漏、跨 Scope、Deadline 计算错误、重复升级或容量长期不足必须填写 `{postmortemUrl}`。
