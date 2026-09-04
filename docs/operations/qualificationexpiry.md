# Qualification expiry

`qualificationexpiry` 在经营资质的 `expiresAt` 到达后，以案件版本作为幂等围栏，把仍处于已发布状态的案件转换为已到期并写入 `qualification.expired` Outbox 事件。

处理失败时由 Runtime Job 按统一退避策略重试；重复任务、旧版本任务、已撤销案件和尚未到期案件安全空操作。连续失败进入 `runtime.deadletter`，值班人员应先核对数据库连接、案件版本和 Outbox 外键，再重放同一任务，不得直接修改材料 Hash、案件版本或到期时间。
