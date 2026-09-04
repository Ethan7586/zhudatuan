# 订单标准事件作业

`orderevent` 以 Inbox 幂等消费 `payment.captured`、`fulfillment.shipped` 和 `refund.completed`。作业只通过事件合同更新订单自有状态与资金效果表，不查询支付或履约私表。

## 告警与恢复

- `ORDER_EVENT_CONTEXT_MISSING`：事件尚未进入对应 Inbox，检查 Outbox Relay 与事件订阅目录。
- `ORDER_EVENT_CONTEXT_MISMATCH`：事件类型、版本、归属或聚合键不匹配，停止重试并核对生产者合同。
- `ORDER_EVENT_TARGET_MISSING`：目标订单不存在或归属不一致，检查事件因果链与数据迁移。
- `ORDER_PAYMENT_EVENT_EVIDENCE_INVALID` / `ORDER_REFUND_EVENT_EVIDENCE_INVALID`：金额、币种或消费者证据不符合订单快照，转死信并人工核验，禁止直接改订单状态。
- `ORDER_FULFILLMENT_EVENT_STATE_INVALID`：履约状态不在标准枚举内，修复生产者后从 Runtime 任务中心重试。

同一事件 ID 或同一支付/退款来源重复投递不会重复记账。重试前必须保留原事件，不得人工构造替代资金事件。
