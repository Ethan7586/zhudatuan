# AU-061｜payment webhook、退款与恢复深审

- 本单元覆盖微信签名回调的目标解析与 inbox/job 转交、查询/关闭/超时/晚到支付状态机、退款计划与 provider 退款观察、退款结算、deadletter 转 recoverycase，以及受控人工恢复操作。
- 回调在验证 provider 签名后，以 provider reference、金额、币种、付款人哈希、scene/application hash 或退款外部金额核对目标；只在 inbox 接受后创建唯一 webhook job。Job 查询的 provider 成功会以不可变 effect/hash 封存，退款也以同样的 provider evidence 才能完成资金恢复。
- 退款计划锁 payment 与 tender，按经济 tender 的已退金额分配；退款完成锁 refund/payment/intent，恢复 benefit/voucher、更新 payment、售后供应链、订单和 outbox。晚到支付不会重新履约，而是释放 holds、建立 critical recoverycase 并自动退款。
- deadletter 按 job 自身 intent/refund 反查 mall，不依赖订单表；人工恢复操作按 mall scope、case 状态、动作与 request idempotency 入队重放/查询/退款。
- F-0148 的 line ownership 与缺省退款金额风险在此链继续得到直接证据。新增 F-0149/P2：回调接收、退款恢复和人工 recovery 的行为测试不覆盖真实 handler/事务结果。固定审计 worktree 无 vitest 可执行文件，未安装依赖；未发现 P0/P1。
