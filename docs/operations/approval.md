# 审批运行手册

## 目标

`approvalescalation` 只处理已到期的审批任务：按模板冻结版本执行通知、重新分配或超时拒绝，并在同一事务内写入审批状态与 Outbox。它不得直接修改卡券、财务、订单、装修或风险域数据。

## 观测信号

- 队列：`governance`；任务类型：`approvalescalation`。
- 核心指标：待处理任务数、最早到期时间、升级耗时、升级冲突数、超时实例数、Outbox 积压。
- 关键事件：`approval.task.escalated`、`approval.instance.expired`。
- 告警：最早到期时间落后当前时间 5 分钟以上、连续三次 Job 失败、Deadletter 新增或同一任务升级次数异常增长。

## 排查顺序

1. 读取 Runtime Job 的状态、attempt、lease owner、fencing token 与最后错误码；不得直接把运行中任务改成成功。
2. 按 `instance_id` 查看实例是否仍为 `pending`，任务是否仍为 `pending/escalated`，模板版本是否存在且与实例冻结版本一致。
3. 检查任务 `due_at`、`escalation_count` 与冻结模板的 `escalations` 数组；`afterHours` 按任务截止时间计算且必须严格递增，非空计划最后一步必须是 reject，确认当前动作是 notify、reassign 或 reject。
4. 检查 `runtime.outbox` 是否存在同聚合的新事件，以及是否因下游 Notification 暂时失败而积压。
5. 若发生版本冲突，重新读取当前状态；终态实例和已决定任务不得重开或覆盖。

## 恢复

- 可重试错误：由 Runtime 使用原 Job ID、租约和 fencing token 重试；状态条件更新保证重复执行无额外决定。
- 配置错误：停用有问题的模板，新建修订版本并重新启用；已创建实例继续使用冻结旧版本。
- 卡住任务：确认实例仍为 pending 后，可安排新的 `approvalescalation` Job；不得手工改任务/实例状态。
- 错误决定：审批决定不可删除或覆盖。请求域根据业务规则重新发起审批，原实例和 Proof 保留审计。
- Proof 过期或已消费：不得恢复 token；重新发起绑定相同对象、动作和新版本的审批。

## 安全边界

- 申请人与审批人必须是不同 Membership；权限、角色或指定成员分配均由服务端验证。
- Proof 只绑定 Scope、对象类型/ID/版本、动作、额度/币种、证据 Hash、约束、执行 Operation、执行请求 Hash、15 分钟内的期限和一次消费记录。
- 日志、错误、指标和工单不得记录原始 Proof、PII 或业务 Secret。
- 所有人工修复必须留下审计记录、操作者、原因、影响对象和前后状态证据。
