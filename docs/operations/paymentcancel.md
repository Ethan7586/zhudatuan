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
3. 检查 `job:cancelquery:*` 的查询恢复任务；失败时从 `runtime.deadletters` 和支付恢复中心重试。
4. 禁止直接修改订单、支付或库存状态；只能重放原事件或重试恢复任务。

## Trigger, impact and owner

Trigger 是 `order.cancelled`；Impact 是外部支付仍可完成或资源占用未释放。Payment Owner 主责，Order、Inventory、Voucher、Benefit 与 Marketing Owner 协同。

## Stop loss and diagnosis

Stop loss 阻止新 Capture，保留未知支付的恢复查询。Diagnosis 依次核对 Inbox、Intent/Action、稳定外部单号、所有 Hold、`paymentquery`、Provider 回执与 Outbox。

## Recovery and data repair

Recovery 使用原事件和稳定幂等键；Data repair 仅通过查询、退款与资源恢复 Saga 前向执行，禁止伪造 Provider 结果。

## Validation, escalation and audit

Validation 证明支付事实唯一、资源只释放一次、迟到成功必退款且账务平衡。Escalation 包括重复扣款、未知状态超时、退款失败和跨订单关联。Audit 保存脱敏 Provider 引用、Job/Event/Trace 和金额核对。

## Postmortem

重复扣款、资源泄漏或 SLO 超限必须完成 Postmortem。
