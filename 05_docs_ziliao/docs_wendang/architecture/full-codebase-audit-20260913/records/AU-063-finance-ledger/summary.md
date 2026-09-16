# AU-063｜finance 事件记账与供应商退款反转深审

- 本单元覆盖从已接收 inbox 读取不可变 outbox 事实的 PostJournal、订单外部 tender 应收计提、支付/退款/晚到支付记账、取消订单反转，以及供应商订单/售后退款的双分录事实。
- PostJournal 在 inbox 行锁事务内只使用 outbox 的 scope、时间和 payload；先重查 order/payment/refund 事实与 tender 合计，再调用 FinancePort。数据库的 finance.post 以 scope/reference type/reference id 唯一约束和内容核对保证 journal 幂等；处理成功后才标记 inbox。
- 供应商售后回放以 aftersale 创建时间作为会计时间；相同 reference 经过 finance.post 的数据库幂等路径不会重复生成 journal，supplier fact/reversal 再以自身唯一键去重。
- 已有定向 mock oracle 覆盖订单 mixed tender、inbox replay、错误 tender、晚到支付、scope 不一致、取消反转和供应商售后重试时间。固定审计 worktree 无 vitest 可执行文件，未安装依赖；未发现 P0–P3 新问题。
- AU-064 保留 Finance job 注册、结算/对账/提现/发票、读写 API、策略和数据迁移专项。
