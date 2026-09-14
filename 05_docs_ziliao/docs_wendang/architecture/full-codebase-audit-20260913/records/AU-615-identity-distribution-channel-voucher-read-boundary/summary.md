# AU-615｜Identity 分销、渠道与券读取边界

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260831110000_identity_distribution_channel_voucher_read_boundary.sql`（100 行）。
- 审阅方式：逐行人工审阅 relation/predecessor guard、24 table grant/revoke、动态 RLS policy 和 assertions；交叉检查 IdentityRegistrationApi 注册的 Referral/Channel/Voucher operator read modules。未连接数据库或执行迁移。

## 审计结论

- **G0：保留。** IdentityRegistrationApi 确实注册 Referral、Channel、Voucher operator read module，迁移提供相应只读 table projection；不能删除。
- [FACT][E-AU-615-001] migration 要求 AU-614 exact predecessor、无 future head、identity role 与 25 个 relation 存在；只授予 schema usage/SELECT，显式回收所有写类 table privilege。
- [FACT][E-AU-615-002] 24 个动态 `identityapiread` SELECT policy 都生成 `using (true)`，不同于 AU-614 的 `access.scope_allowed` 或 relation scope provenance；数据库层对该 role 不再限定行范围。
- [FACT][E-AU-615-003] IdentityRegistrationApi 注册对应 operator read modules，应用 AccessPipeline 仍执行 operation/scope authorization；但直接/新增 SQL 查询的越界防护依赖应用层，详见 F-0264。

## 未验证项

- 未以 identity role 执行跨 scope SELECT，也未运行各 operator read API 的端到端授权测试；当前 application query 是否全部自行带 scope predicate 未全量验证。

## 结论等级

- 新增问题：P2 1 项（F-0264）。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：是；需重新检查各 24 relation 的真实 scope ownership 与 Identity API query path。
