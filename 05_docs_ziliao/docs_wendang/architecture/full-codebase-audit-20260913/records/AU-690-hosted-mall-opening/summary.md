# AU-690｜SFL Hosted Mall Opening

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260912040000_create_sfl_hosted_mall_opening.sql`（407 行）。
- 审阅方式：深入审阅。核对 capability history、atomic opening function、member/Web operation registration、idempotency/rollback/event outbox、后续 template-clone compatibility和 SQL contract；未重复审阅 generic organization tables。

## 审计结论

- **G0：保留。** module 将一个 hosted consumer node 受控升级为 operating Mall，并在同一事务持久化 Mall、enterprise binding、capability version、shared-host configuration、change/audit outbox及可重放 opening fact。
- [FACT][E-AU-690-001] `member.malls.open` 被注册为 runtime operation/capability，并由 Member/Web Business module的 `hostedMallOpeningAction` 从认证 access的 membership、Realm和 server-resolved node context调用；DB command仅授予 `zhudatuanwebapi` execute，无 table access。
- [FACT][E-AU-690-002] function锁定 idempotency+node，要求 active storefront membership/account/Realm/node、hosted consumer profile和 capability history；创建 organization/binding后才升级 Realm/target/membership/node profile、写 capability version、opening/configuration/change/outbox，失败中断由单事务回滚。
- [FACT][E-AU-690-003] `sfl_hosted_mall_opening_contract.sql` 覆盖跨 Realm isolation、replay/key conflict、capability history、zero-infrastructure constraints、运行中断 rollback/retry与失败请求不改 node；后续 company template clone明确演进 opening/configuration status/payment mode，未把初始记录误判为废弃。
- 未发现该模块的独立缺陷或垃圾代码候选。

## 未验证项

- 未在真实 Web API session中执行 opening，未验证 capability entitlement在生产数据库的发布状态。
- 未验证 outbox consumer 对 `sfl.hosted_mall.opened` 的真实异步处理；本单元仅确认生产者和事件登记。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（hosted Mall opening aggregate/atomic command）；不新增 G1/G2/G3/GX。
- 二次复核：否。
