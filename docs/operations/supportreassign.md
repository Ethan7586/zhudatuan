# 客服批量重分配运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

客服停用后仍持有活动 Conversation、未分配比例异常、重分配 Job 停滞/冲突或高优先级会话无人处理时触发。消息与持久历史保持可读；跨 Scope 分配或 SLA 大面积失守为 P0/P1。

## Owner 与前置权限

Support Queue Supervisor 主责，Support/Runtime Owner 协同。操作需目标 Scope 分配权限、规则版本和 ExpectedVersion；客服停用与批量转派均写不可变原因和 Actor。

## 只读诊断（Diagnosis）

核对 Agent 状态/技能/容量/Scope、Assignment 规则版本、候选队列、Conversation 优先级/SLA、Job Lease/Fencing/Cursor、Version Conflict、消息历史和通知 Receipt。锁顺序固定 Conversation→Assignment。

## 止血（Stop loss）

暂停继续停用和异常批次，把紧急 Conversation 放入受控人工未分配队列；保留实时流与历史。禁止直接改 Assignment、删除历史或跨 Scope 临时指派。

## 恢复（Recovery）

修正规则/容量后以原 JobId 从 Cursor 重试，稳定批次逐项锁定；无合法候选时保持未分配并升级，不伪造分配。人工接管使用正式 Assign Operation 并追加原因/事件/通知。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 证明停用 Agent 活动分配为 0、每个 Conversation 最多一个活动 Assignment、Scope/技能/容量合法、历史/事件/通知完整。Data repair 只追加转派；Escalation 紧急无人/跨 Scope；Audit 保存规则、Cursor 和前后 Assignment。

## 回滚边界

未执行批次可取消；已转派不删历史，可通过新转派恢复。已发通知不回退，必要时发送更正。

## 沟通模板

“客服转派 `{jobId}`，Scope `{scope}`，已处理/未分配 `{assigned}/{unassigned}`，紧急影响 `{impact}`，人工 Owner `{manualOwner}`，证据 `{evidenceRef}`。”

## 关闭条件

停用 Agent 活动分配清零；紧急 Conversation 均有 Owner；唯一分配/Scope/历史/通知核对通过；Job 和告警恢复。

## 复盘链接（Postmortem）

跨 Scope、紧急会话无人处理、锁死或容量长期不足必须填写 `{postmortemUrl}`。
