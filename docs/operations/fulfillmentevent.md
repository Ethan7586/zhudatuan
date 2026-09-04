# 履约事件任务

`fulfillmentevent` 消费 `order.paid`、`channel.webhook.applied` 与 `verification.completed`。订单支付事实由履约域按商品类型和渠道拆分为独立履约单；渠道回调只触发确定性的物流同步；数字或卡券核销事实完成对应履约。

## 一致性与恢复

- Inbox 键为 `job:fulfillmentevent + eventId`，重复投递不会重复拆单、发货或完成履约。
- 拆单、履约行、订单读模型和后续任务在同一数据库事务中提交。
- 渠道回调不直接写履约表，只创建可重试的 `tracking` 任务。
- 失败任务进入 `runtime.deadletter`；排障前核对 Inbox、履约单与 Saga 步骤，不得手工伪造成功状态。

## 排障查询

```sql
select event_id,state,attempts,last_error from runtime.inbox where handler='job:fulfillmentevent' order by updated_at desc limit 100;
select id,order_id,route,state,version from fulfillment.fulfillmentorder where state in('failed','needsaction') order by updated_at desc limit 100;
select fulfillment_id,step,state,attempts,error_code,next_attempt_at from fulfillment.sagastep where state<>'succeeded' order by updated_at desc limit 100;
```
