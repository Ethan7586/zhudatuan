# 订单取消支付收敛

`paymentcancel` 消费 `order.cancelled`。处理器先在 Payment 自有事务中终止未完成支付意图、失效支付动作，并通过公开端口释放库存、卡券、福利和营销占用；随后最佳努力关闭外部支付，再创建确定性的 `paymentquery` 恢复任务。

## 幂等与一致性

- Inbox 键为 `job:paymentcancel + eventId`，同一取消事实只完成一次。
- 支付意图只允许从活动态单调进入 `cancelled`，重复执行不会重复增加版本。
- Hold 释放必须幂等；外部关单使用稳定订单号，允许安全重试。
- 无论外部关单返回、超时或未知，均由 `paymentquery` 查询权威状态。若订单取消后支付成功，既有迟到支付流程会自动创建退款和恢复工单。

## 排障

1. 按 `eventId` 检查 `runtime.inbox` 与 `runtime.job`。
2. 按 `order_id` 检查 `payment.intent`、`payment.action` 与各类 Hold 状态。
3. 检查 `job:cancelquery:*` 的查询恢复任务；失败时从 `runtime.deadletter` 和支付恢复中心重试。
4. 禁止直接修改订单、支付或库存状态；只能重放原事件或重试恢复任务。
