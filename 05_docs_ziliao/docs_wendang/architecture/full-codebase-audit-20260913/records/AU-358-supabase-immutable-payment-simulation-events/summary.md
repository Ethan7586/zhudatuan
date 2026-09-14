# AU-358｜Supabase 测试支付模拟事件不可变性

`20260810162000_immutable_payment_simulation_events.sql` 为测试支付模拟的两类事实表 `payment_simulations` 与 `test_point_ledgers` 注册 `before update or delete` 触发器。触发器复用早期生产 MVP 已定义的 `public.reject_immutable_change()`，该函数会抛出以表名命名的不可变异常；因此模拟交易记录与积分流水只能追加，余额与券余额仍由其各自的可变表维护。

当前 Commerce API 的 simulation router 仍经三个 RPC 写入这些事实表，且后续券生产域迁移明确不提升 `test_vouchers` 或 `payment_simulations`。这项迁移仍承担测试模拟回放和审计事实完整性的真实职责，归 G0；没有静态或运行证据支持将其视为可删除的历史残留。

本单元仅作源码与迁移顺序核验；未连接数据库、未执行测试或模拟支付。未发现新增 P0–P3 或删除候选；AU-356 的并发幂等 P2（F-0236）与本不可变保护独立，仍维持原结论。
