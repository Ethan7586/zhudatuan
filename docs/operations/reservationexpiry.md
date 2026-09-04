# 库存预占到期作业

`reservationexpiry` 仅处理仍为 `reserved` 且已到 TTL 的库存预占。作业按库存项、预占 ID 加锁，批量写入到期状态、追加账本和 Outbox；已确认、已释放或已到期记录均不会再次变更。

告警处置：先检查 `runtime.job` 的失败原因和 `inventory.reservation` 的版本，再确认数据库时钟、锁等待和 Outbox 积压。禁止手工同时写确认与释放状态；需要重放时复用原作业 ID 和 owner。
