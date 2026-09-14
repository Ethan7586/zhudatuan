# AU-596｜推荐佣金基础迁移

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260829105000_create_referral_foundation.sql`（952 行）。
- 审阅方式：逐段人工审阅 referral schema、唯一键/FK、首触绑定、佣金撤销/追回、提现 claim/state trigger、金融事件不可变性、RLS/grant；交叉检索 Referral command/read/API route、Referral worker 和 Finance Settlement Job。未连接数据库、未执行迁移或财务动作。

## 审计结论

- **G0：保留。** 该 migration 是推荐关系、佣金事实、反转追回与提现证据的唯一数据基础，且扩展 finance withdrawal source contract 和金融 outbox/inbox 不可变规则；不能因关系表暂无某一 HTTP import 而删除。
- [FACT][E-AU-596-001] `setting/product/member/binding/commission/commissionmovement/recoverymovement/withdrawalclaim` 均有 scope identity、业务唯一键和跨表 FK；佣金按 `origin_event_id + order_line + kind + beneficiary` 去重，movement 对同来源事件/退款去重，避免重复事件重复记账。
- [FACT][E-AU-596-002] `referral.bind_first_touch` 验证启用设置、active referrer 和非自绑定，以 `FOR UPDATE` 与冲突重试实现首触归属；有效 binding 保持原 winner，过期 binding 才能重新绑定，返回结果区分 created 与既有事实。
- [FACT][E-AU-596-003] commission/recovery movement 通过 trigger 保证不可更新/删除、同一来源幂等、反转不超过剩余额度、已结算反转必须有不同 journal；`ProcessReferralEvent` 与 `SettleReferralCommissions` 是实际写入/结算 Worker，Finance `SettlementJob` 消费 referral withdrawal paid 事件。
- [FACT][E-AU-596-004] referral withdrawal 必须具有 source/member/claim/金额/币种一致证据；状态机禁止自审批、等待未处理退款反转时审批/处理/支付，并把 withdrawal state 同步到 claim。金融 outbox/inbox 对 referral/order/payment/invoice 事实施加不可变与 90 天保留约束。
- [FACT][E-AU-596-005] shopapp 只能在授权 scope 读取佣金事实、创建 claim/绑定，shopjob 才能生成或更新佣金；RLS 及最终断言拒绝 app 对 commission/movement/recovery 的写入和 job 对 immutable movement 的更新/删除。

## 未验证项

- 未运行 referral worker、付款/退款/撤销/追回、提现审批与支付、RLS deny、并发 first-touch 或金融回滚；真实财务 journal、外部打款与事件最终投递状态未知。
- 未核验实际业务规则（佣金比例、结算延迟、提现限额）是否与运营政策一致；本 migration 只能证明技术边界和数据约束。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；任何后续佣金/提现变更应在隔离 PostgreSQL 覆盖重复事件、部分退款、已结算反转、追回抵扣、并发绑定和全部提现状态迁移。
