# AU-059｜order 创建、履约确认与售后深审

- Commerce 与 Purchase selected module 都以 `PlaceOrder` 为订单创建事实链：锁定有效报价/active cart、验证 HMAC 后重算当前报价，在 ModuleOperations 幂等命令事务及 `inventory:<mall>` 串行键中依次预留库存/券/福利/营销，写订单、线路、子单、供应事实与支付计划，确认 checkout、转换 cart、入队超时任务，并追加三个 outbox 事件。
- `orderexpiry` 已在 worker catalog 注册；在同一事务中取消过期未付款订单、释放 holds，并将存在微信尝试的 intent 交由 paymentquery。收货确认以行锁、全部 fulfillment 发货门槛、expectedVersion 和稳定 event id 收口。
- F-0148（P2）：售后申请未验证指定 line 属于目标 order；且 line 级申请省略 amountMinor 时退款 worker 默认用整笔已收未退金额，后续供应商行额度分配会失败。现有测试未覆盖这两项链路。未发现 P0/P1。
