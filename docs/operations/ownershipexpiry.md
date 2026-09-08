# 所有权转移过期任务

`ownershipexpiry` 在所有权转移申请的有效期结束时运行。任务只会把仍处于 `pending` 且确已到期的申请原子更新为 `expired`，写入时间线，并发布 `access.owner.transfer.expired`。已经接受、取消或被其他执行器处理的申请保持不变，因此任务可安全重试。

排障时先按任务载荷中的 `transfer` 检查 `access.ownershiptransfer`，再核对 `access.ownershiptimeline` 与 `runtime.outbox`。失败任务进入 `runtime.deadletters`；修复根因后按原任务标识重试，不要直接改写所有权或证明记录。

## Trigger, impact and owner

Trigger 是待接受转移超过冻结的 `expiresAt`；Impact 是旧 Owner 仍保有治理权或待办持续积压。Access Owner 主责，Identity 与 Security Owner 协同核验双方身份和 Step-up 证据。

## Stop loss and diagnosis

Stop loss 仅暂停异常 Scope 的过期任务，不得扩大旧 Owner 权限或直接替换 Owner。Diagnosis 依次核对 Job lease/fencing、转移版本、到期时间、接受/取消时间线、Proof 消耗、Outbox 与服务器时钟。

## Recovery and data repair

Recovery 使用原 Job ID 重试；Data repair 只能通过前向修复任务重建缺失时间线或 Outbox，且必须绑定源转移 ID、版本和审批证据，禁止原地改所有权。

## Validation, escalation and audit

Validation 要证明 pending 已单调进入 expired、双方权限未越界、事件恰好一次且新转移仍可创建。Escalation 覆盖跨 Scope、时间倒退、Proof 重放和重复 Owner。Audit 保存前后状态、版本、Job/Event/Trace、操作者和核对结果。

## Postmortem

越权窗口、错误过期、死信或 SLO 超限必须完成 Postmortem，并落实检测、恢复和防复发 Owner。
