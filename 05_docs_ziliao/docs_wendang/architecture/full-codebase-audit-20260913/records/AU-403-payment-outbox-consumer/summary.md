# AU-403｜支付 outbox 消费者

`20260820124000_payment_outbox_consumer.sql` 将微信支付 outbox 演进为版本化事件：不可变 envelope、租约 token、防陈旧确认、consumer inbox 去重、accounting/fulfillment/notification effect fan-out 与 dead-letter 审批/回放。事件消费与 effect 创建在同一事务中完成，投递保持 at-least-once 语义。

后续 payment-domain outbox/cutover、effect processor 与恢复契约继续使用并验证该语义；支付、退款、到期和内部支付合同均覆盖 claim、finish、重放、死信与 effect 路径。该迁移承担当前支付事件链的历史兼容职责，归 G0，不是删除候选。

未发现新增 P0–P3；未执行测试、数据库写入、构建或线上检查。
