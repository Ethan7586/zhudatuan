# AU-055｜marketing 活动预算与订单预留深审

- Marketing 的 HTTP 面只提供 operator `marketing.campaigns.read`；活动创建/规则管理不由当前模块的公开 API 承诺。`MarketingPort` 是订单/支付内部契约，实际由 `PlaceOrder` 预留、`PaymentSettlement` 提交、订单到期或支付关闭时释放。
- 预算更新是条件原子 SQL（仅 active campaign 且 remaining budget 足额），然后写入 `marketing.redemption`；调用点均在订单或支付的数据库事务内。release 先把 reserved redemption 转为 released，再按返回金额减少 campaign spent；重复 release 无行返回，因此不重复扣减。
- 数据库迁移规定 campaign 预算、状态、币种和时间窗约束，以及 redemption 的 campaign/member/idempotency 唯一性。`zhudataanpurchaseapi` 的受限列授权只允许预算和 redemption state 变更；基础 RLS migration 为已存在 marketing 表建立 `shopjob` 全权限 jobscope，orderexpiry/payment jobs 连接使用 job profile（实际 env 约束为 shopjob）。
- checkout 仅读取当前有效、尚有预算的 campaign；Experience 发布又只允许引用 active/有效 campaign。活动数据由 marketing 拥有，checkout/order/payment 只能通过 Port 预留/提交/释放。
- 未发现 P0/P1 新问题。新增 F-0145（P2）：预算预留、重复/并发、支付提交与超时释放这条真实链没有模块专用行为测试；唯一 marketing 模块测试只检查 manifest。正式 Vitest 未运行（固定审计 worktree 缺 `vitest` 命令），未安装依赖或改变运行状态。
