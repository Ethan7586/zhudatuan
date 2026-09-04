# 渠道回调任务

- Trigger：`channelwebhook` 延迟超过 30 秒、同一事件反复失败、出现 Dead Letter，或 Provider 回调成功率/验签失败率越过告警阈值。
- Impact：受影响连接的订单、物流或退款外部状态不能推进；业务继续以数据库最后一个权威状态为准，客户端成功提示不能代替回调事实。
- Owner：Channel 值班负责人主责；对应 Order、Fulfillment 或 Payment Owner 负责验证领域结果。
- Stop loss：仅停用故障连接的回调消费和新远程写，保存 Cursor、Raw Envelope、Inbox、Provider Operation 与 Trace；不得清空 Inbox 或手工改业务状态。
- Diagnosis：按 Scope 核对连接健康、Manifest/Contract Version、证书或密钥版本、事件编号、外部业务号、验签时间窗、`channel.webhookinbox`、`channel.provideroperation` 与任务尝试记录。
- Recovery：修复凭据、时钟、连接或 Mapper 后，以原 Job ID 重放；订单/物流回调触发主动查询，退款回调通过 `channel.refund.changed` 交还 Payment Owner。
- Data repair：只允许使用 Owner 模块的恢复命令补建缺失投影；不得改写原始 Envelope、伪造外部事件编号或直接更新 Order/Payment/Fulfillment 表。
- Validation：核对接收数、去重数、成功数、失败数、外部查询结果、领域状态、Outbox/Inbox 消费位点和财务对账；同一 Provider Event 只能产生一次业务效果。
- Escalation：15 分钟通知 Provider Owner，30 分钟升级 Commerce Incident Commander；涉及支付或跨租户数据时立即升级 Security 与 Finance。
- Audit：记录停用/启用、凭据版本、重放操作者、理由、Job ID、事件 ID、Trace、修复前后 Hash 和验证结果。
- Postmortem：附时间线、根因、受影响 Scope/事件、SLO、恢复证据、残余风险与防复发行动。
