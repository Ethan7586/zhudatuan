# AU-614｜Identity Finance 读取边界

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260831100000_identity_finance_read_boundary.sql`（97 行）。
- 审阅方式：逐行人工审阅 head/relation guard、12 张 finance table 的 read-only grant/RLS 和 ACL assertion；交叉检查 IdentityRegistrationApi 的 `IdentityOperatorFinanceModule` 注册。未连接数据库或执行迁移。

## 审计结论

- **G0：保留。** Identity Registration API 提供 operator finance read operations，需要该专用 API role 的 finance 只读关系投影；不可按“identity 不应写 finance”误判为无用。
- [FACT][E-AU-614-001] precondition 绑定 AU-613 predecessor、拒绝 future head，并要求 identity role 与 12 个 finance relation 已存在；未知 schema 不会静默放宽访问。
- [FACT][E-AU-614-002] 只授予 finance schema usage 和 12 表 SELECT，显式撤销每表 INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER；assert 逐表验证 read-only privilege。
- [FACT][E-AU-614-003] 每张表的 `identityread` policy 都以 `access.scope_allowed` 控制，entry/journal 通过 account/entry 回溯 scope；不会因 role privilege 而跨 scope 读取。IdentityRegistrationApi 显式注册 `IdentityOperatorFinanceModule` 作为运行消费者。

## 未验证项

- 未以 identity API database role 测试每张表的同/跨 scope read、写入拒绝和 relation join RLS；线上 policy 共存状态未验证。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；后续追加 finance read relation 时应同时添加 scope provenance 和写权限反事实检查。
