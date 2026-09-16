# AU-060｜payment 支付意图与捕获核心深审

- 本单元覆盖支付意图计划、Storefront/miniapp 外部预下单、内部捕获、签名/应用上下文、member+mall 读取、资金分摊和支付成功事件；回调、退款、job 和恢复操作留给 AU-061。
- 外部预下单先在命令事务中锁意图和订单、记录 attempt；外部调用后将成功参数或未知结果以独立事务写回，并为未知结果入队 query。KMS 失败和确定性拒绝仅标记失败，避免把未发生的 provider 调用误判为未知。
- 捕获在意图/支付行锁下校验 tender 总额，消费内部 tender、提交库存/营销、写 payment/capture/经济分摊、更新订单并创建履约和 outbox。Provider 成功的发生时间经严格 RFC3339 校验后才进入金融事件；内部支付不能伪造该时间。
- 已有定向 mock oracle 覆盖 timeout/拒绝/持久化失败、生命周期、支付读取隔离、Mall identity、分摊和 provider 时间。固定审计 worktree 无 vitest 可执行文件，未安装依赖；未发现 P0–P3 新问题。
