# AU-688｜SFL Member Registration Progression

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260912020000_create_sfl_member_registration_progression.sql`（307 行）。
- 审阅方式：深入审阅。核对 registration/boundary ledgers、direct/invitation state machine、hosted node creation、Identity RegistrationOperations/MemberPort consumer和 SQL contract；未重复审阅基础 hosted node provisioning implementation。

## 审计结论

- **G0：保留。** function 将 Storefront member registration 的业务身份、来源 invite、node lineage、Realm和membership 以不可重放的事实记录；L11不再创建 L12 node，而保存可重试的 boundary outcome。
- [FACT][E-AU-688-001] direct registration从 active operating-Mall L0–L5 host创建 L6 consumer child；invitation registration锁定有效 Storefront invite、要求 invite Mall=host Mall、inviter 为同 line L6–L11 Storefront membership，并将新 node作为 inviter child。
- [FACT][E-AU-688-002] function 在任何 Realm/node write 前完成输入/idempotency/cross-line checks；L11 invitation仅写 `memberregistrationboundary`，不消费 invite或创建 Realm/node；成功路径才创建 consumer Realm、调用 AU-686 provisioning、再消费 invite并写 registration fact。
- [FACT][E-AU-688-003] `RegistrationOperations` 在 invitation Storefront path 调用 MemberPort command并把 `level_boundary` 映射为 409；`sfl_member_registration_progression_contract.sql` 覆盖 inviter chain、cross-line rejection、L11 boundary replay、无 L12/无 invite consume和无基础设施字段泄漏。
- 未发现该模块的独立缺陷或垃圾代码候选。

## 未验证项

- 未在生产真实 invitation/Realm 数据上核验 L11 boundary 的业务运营处理与后续升级路径。
- 未并发执行同一 business identity 的不同 idempotency key，数据库 advisory lock/unique constraints的实测竞争行为未验证。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（member registration lineage/boundary state machine）；不新增 G1/G2/G3/GX。
- 二次复核：否。
