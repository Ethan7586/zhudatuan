# 审批运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

Approval Template 错误、任务超过截止时间、升级/分配停滞、Proof 过期/重放、职责分离冲突、错误批准/拒绝或 Job Deadletter 时触发。高风险业务停滞为 P1；越权决定、Proof 重放或同人申请审批为 P0。

## Owner 与前置权限

Approval Owner 主责，请求领域、Access、Notification、Runtime 与 Security 协同。Template 创建/修订/启停需要权限和 ExpectedVersion；审批人与申请人必须为不同 Membership；人工恢复需要 Step-up、事件工单和双人监督，不能代替业务 Owner 决定。

## 只读诊断（Diagnosis）

核对 Template/Revision/Active Version、Instance 冻结版本、Request Object/Action/Version/Amount/Currency/Evidence Hash、Task Assignee/State/DueAt/Escalation、Proof 约束/期限/消费、Separation、Outbox/Notification、Job Lease/Fencing 和数据库时间。终态 Instance/Task 不重开。

## 止血（Stop loss）

暂停异常 TemplateVersion 的新实例，不影响其他模板；撤销可疑未消费 Proof，冻结关联高风险 Operation。禁止绕过审批、改截止时间、覆盖决定、把 Task 直接标成功或让申请人代理审批。

## 恢复（Recovery）

模板错误通过新 Revision 修复，已有 Instance 继续冻结旧版本；卡住 Task 在确认 pending 后以原 Instance/Task 幂等重新调度 escalation，按 notify→reassign→reject 的冻结策略执行。Proof 过期/已消费不能恢复，必须重新发起绑定当前对象/动作/版本/请求 Hash 的审批。错误决定保留，业务域新建补偿请求。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 证明模板版本冻结、申请/审批职责分离、每 Task/Instance 最多一个决定、Proof 一次消费且绑定 Scope/对象/动作/版本/额度/Operation/Request Hash，业务效果和通知一致。Data repair 只新 Revision/Instance/补偿；Escalation 越权 P0；Audit 保存完整因果链不保存原 Proof。

## 回滚边界

未决定 Instance 可取消；批准/拒绝和已消费 Proof 不删除/回退。业务效果只能由请求领域补偿/冲正，不能改 Approval 历史。

## 沟通模板

“审批事件 `{incidentId}`，Template/Instance `{templateId}/{instanceId}`，Task 状态 `{state}`，截止/升级 `{dueAt}/{escalation}`，业务影响 `{impact}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

模板状态正确；所有逾期 Task 已升级/拒绝或有合法 Assignee；职责分离、单次决定、Proof 消费、业务效果和通知核对通过；Deadletter/告警清零；证据归档。

## 复盘链接（Postmortem）

越权/错误决定、Proof 重放、职责分离失效、模板批量影响或 SLO 违约必须填写 `{postmortemUrl}`。
