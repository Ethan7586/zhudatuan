# 库存预占到期作业

`reservationexpiry` 仅处理仍为 `reserved` 且已到 TTL 的库存预占。作业按库存项、预占 ID 加锁，批量写入到期状态、追加账本和 Outbox；已确认、已释放或已到期记录均不会再次变更。

告警处置：先检查 `runtime.job` 的失败原因和 `inventory.reservation` 的版本，再确认数据库时钟、锁等待和 Outbox 积压。禁止手工同时写确认与释放状态；需要重放时复用原作业 ID 和 owner。

## Trigger, impact and owner

Trigger 是活动预占超过 TTL；Impact 是可售库存被长期占用或错误释放造成超卖。Inventory Owner 主责，Checkout 与 Order Owner 协同。

## Stop loss and diagnosis

Stop loss 暂停受影响库存项的新分配并保持既有账本不可变。Diagnosis 核对 Job lease/fencing、库存项、预占状态/版本/到期时间、订单状态、数据库时钟、锁等待和 Outbox。

## Recovery and data repair

Recovery 使用同一 Job ID 重试。Data repair 仅追加有依据的库存调整和状态事件，禁止覆盖 on-hand、删除账本或同时确认与释放。

## Validation, escalation and audit

Validation 通过账本重放证明 on-hand、reserved、available 守恒且无负数/重复有效预占。Escalation 包括超卖、跨 Scope、错误释放和锁风暴。Audit 保存库存项、预占、订单、前后版本、Job/Event/Trace。

## Postmortem

库存不变量破坏或 SLO 违约必须完成 Postmortem。
