# AU-062｜fulfillment 履约、发货与退货深审

- 本单元覆盖 payment 成功后的 fulfillment 创建、provider 提交与 tracking worker、客户 tracking 读取、人工 shipment、退货收货/质检、供应商售后回放与 module/job 注册。
- PaymentSettlement 用 mall/member/order/payment 创建按 suborder 路由聚合的 fulfillment 与 line，并入队 provider 提交；worker 在 provider 为空时直接接受，本地 provider 则以 Order.submit 后记录 channel operation 并转 tracking。tracking 去重里程碑、发出稳定 shipped event；完成时通过 OrderPort 发布收货事件。
- F-0127（Private provider 的 Logistics capability 不闭合）已读取 fulfillment 侧实际 caller，维持既有第二轮复核结论。新增 F-0150/P2：provider Order.submit 返回失败或未知 state 时，fulfillment 仍被无条件置为 accepted 并转 tracking，丢失可重试的 submit 状态。
- 现有测试主要为 mall SQL 记录型 mock、源码读取和 manifest；没有 provider receipt/state、tracking milestone 或 return command 的事务行为 oracle。固定审计 worktree 无 vitest 可执行文件，未安装依赖；未发现 P0/P1 新问题。
