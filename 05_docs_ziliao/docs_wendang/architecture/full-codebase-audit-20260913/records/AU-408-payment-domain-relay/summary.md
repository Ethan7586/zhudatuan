# AU-408｜支付域出站中继

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260820127200_payment_domain_relay.sql`。
- 交叉核对：付款出站迁移、支付效果/内部支付/故障恢复契约测试，以及 Commerce `PaymentJobs` 运行实现。
- 本批为静态调用链与迁移语义审阅；未执行数据库重放、构建或线上操作。

## 运行结论

三个 service-role RPC 覆盖 payment outbox 的完整中继生命周期：领取操作以 `SKIP LOCKED`、有界租约与按聚合版本阻塞控制并发和先后顺序；启动操作重新核验微信或内部付款的订单、金额、证据和库存状态，再以 inbox 摘要去重生成效果；完成操作仅接受仍持有有效租约的工作者，并使用抖动指数退避及死信审计记录失败。

数据库契约测试覆盖租约丢失、重试、死信、事件扇出、畸形事实拒绝和授权 ACL。可是，在固定基线内，三个精确 RPC 名称未见 Commerce `PaymentJobs` 或其他应用/Worker 调用；该作业当前检索到的是另一套 `payment` 与 `runtime.outbox` 直接数据库模型。系统外 service-role 作业、已部署 Supabase 调度器与历史积压尚不能由仓内静态证据排除。

## 审计结论

- DC-0063 / G1：不可将该链认定为垃圾或删除；先核验真实生产消费者、调用日志和 outbox 状态。
- 本批未新增 P0、P1、P2 或 P3；未运行验证均已明确保留为未验证状态。
