# 订单标准事件作业

`orderevent` 以 Inbox 幂等消费 `payment.captured`、`fulfillment.shipped` 和 `refund.completed`。作业只通过事件合同更新订单自有状态与资金效果表，不查询支付或履约私表。

## 告警与恢复

- `ORDER_EVENT_CONTEXT_MISSING`：事件尚未进入对应 Inbox，检查 Outbox Relay 与事件订阅目录。
- `ORDER_EVENT_CONTEXT_MISMATCH`：事件类型、版本、归属或聚合键不匹配，停止重试并核对生产者合同。
- `ORDER_EVENT_TARGET_MISSING`：目标订单不存在或归属不一致，检查事件因果链与数据迁移。
- `ORDER_PAYMENT_EVENT_EVIDENCE_INVALID` / `ORDER_REFUND_EVENT_EVIDENCE_INVALID`：金额、币种或消费者证据不符合订单快照，转死信并人工核验，禁止直接改订单状态。
- `ORDER_FULFILLMENT_EVENT_STATE_INVALID`：履约状态不在标准枚举内，修复生产者后从 Runtime 任务中心重试。

同一事件 ID 或同一支付/退款来源重复投递不会重复记账。重试前必须保留原事件，不得人工构造替代资金事件。

## Trigger, impact and owner

Trigger 是已声明的支付、履约和退款事件；Impact 是订单状态、金额效果或下游事实不同步。Order Owner 主责，Payment、Fulfillment、Finance 与 Runtime Owner 协同。

## Stop loss and diagnosis

Stop loss 隔离异常事件类型/版本并阻止错误订单继续履约。Diagnosis 核对 Event Schema、Outbox/Inbox、聚合键、订单快照、来源金额、币种、版本和消费者证据。

## Recovery and data repair

Recovery 重放原 Event ID；Data repair 仅通过修复生产者后重放或审批后的补偿事件，禁止构造替代资金事实。

## Validation, escalation and audit

Validation 证明事件恰好一次效果、订单状态单调、支付/退款金额守恒、履约行一致。Escalation 覆盖资金不平、跨订单、未知事件版本和永久死信。Audit 保存完整因果 ID、Hash、前后版本与 Trace。

## Postmortem

资金、履约或一致性事故及 SLO 超限必须完成 Postmortem。
