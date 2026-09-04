# 所有权转移过期任务

`ownershipexpiry` 在所有权转移申请的有效期结束时运行。任务只会把仍处于 `pending` 且确已到期的申请原子更新为 `expired`，写入时间线，并发布 `access.owner.transfer.expired`。已经接受、取消或被其他执行器处理的申请保持不变，因此任务可安全重试。

排障时先按任务载荷中的 `transfer` 检查 `access.ownershiptransfer`，再核对 `access.ownershiptimeline` 与 `runtime.outbox`。失败任务进入 `runtime.deadletter`；修复根因后按原任务标识重试，不要直接改写所有权或证明记录。
