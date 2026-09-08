# 履约事件任务

`fulfillmentevent` 消费 `order.paid`、`channel.webhook.applied` 与 `verification.completed`。订单支付事实由履约域按商品类型和渠道拆分为独立履约单；渠道回调只触发确定性的物流同步；数字或卡券核销事实完成对应履约。

## 一致性与恢复

- Inbox 键为 `job:fulfillmentevent + eventId`，重复投递不会重复拆单、发货或完成履约。
- 拆单、履约行、订单读模型和后续任务在同一数据库事务中提交。
- 渠道回调不直接写履约表，只创建可重试的 `tracking` 任务。
- 失败任务进入 `runtime.deadletters`；排障前核对 Inbox、履约单与 Saga 步骤，不得手工伪造成功状态。

## 排障查询

```sql
select event_id,state,attempts,last_error from runtime.inbox where handler='job:fulfillmentevent' order by updated_at desc limit 100;
select id,order_id,route,state,version from fulfillment.fulfillmentorder where state in('failed','needsaction') order by updated_at desc limit 100;
select fulfillment_id,step,state,attempts,error_code,next_attempt_at from fulfillment.sagastep where state<>'succeeded' order by updated_at desc limit 100;
```

## Trigger, impact and owner

Trigger 是已声明的订单、渠道与核销事件；Impact 是未拆单、未发货或错误完成。Fulfillment Owner 主责，Order、Channel、Voucher 与 Store Owner 协同。

## Stop loss and diagnosis

Stop loss 隔离异常 Provider/履约单，不阻断其他渠道。Diagnosis 使用上述查询并核对事件版本、路由快照、履约行、Saga、回调 Inbox 和外部幂等键。

## Recovery and data repair

Recovery 重放原事件或原 tracking Job；Data repair 只追加前向 Saga 步骤和状态事实，禁止伪造物流或核销成功。

## Validation, escalation and audit

Validation 证明订单行与履约行守恒、单渠道故障隔离、重复事件无副作用。Escalation 覆盖错发、跨订单、凭证重复交付。Audit 保存 Order/Fulfillment/Event/Job/Trace 和脱敏 Provider 证据。

## Postmortem

错发漏发、数据不一致或 SLO 超限必须完成 Postmortem。
