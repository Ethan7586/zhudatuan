# AU-056｜referral 推荐、佣金与提现链路深审

- 运行入口：ReferralModule 提供 settings/product/member/binding/commission/earning/link/withdrawal operations；Identity 只接入受限读取面。`referral` job 消费 order.placed/paid/received/cancelled 与 payment.refunded，随后按 scope 进行佣金结算。
- 事件链：Processor 将 runtime inbox 与同一 outbox 事实锁定，重放已完成 inbox 为 no-op；placed 以订单、设置、生效绑定和行项目为权威事实，稳定 commission id 与 DB 唯一约束避免重复发放。paid/received 按配置进入 settling 并安排 future settlement；取消和退款保留 movement 历史、部分反冲及已结算会计冲销。
- 提现链：会员行锁串行化余额申领；pending reversal 和 recovery 阻止提现；按已结算佣金 oldest-first 预留 claim，随后创建 Finance withdrawal 并由数据库函数附着 claim。成员锁也与 reversal path 的 beneficiary lock 对齐，未发现已证实的余额竞争写入。
- 数据边界：referral 拥有 setting/product/member/binding/commission/movement/recovery/withdrawalclaim；Finance 仍拥有 withdrawal 与 journal。commission settlement 对每个 commission 使用 row lock/skip locked、Finance reference id 和状态条件更新，避免同一佣金重复入账。
- 测试：模块含 policy、operation、event processor、settlement 和 manifest oracle，均以 mock SQL 针对关键状态条件断言；没有在固定审计 worktree 运行 Vitest（缺命令），真实 PostgreSQL/RLS/Finance integration 仍未验证。
- 未发现 P0–P3 新问题。
