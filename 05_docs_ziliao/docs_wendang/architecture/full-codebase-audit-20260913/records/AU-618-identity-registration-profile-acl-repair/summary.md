# AU-618｜Identity Registration Profile ACL 修复

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260831140000_identity_registration_profile_acl_repair.sql`（57 行）。
- 审阅方式：结构性审阅；逐行检查 predecessor/state guards、最小 privilege delta、existing RLS policy 依赖及 IdentityOperatorMemberModule/runtime consumer。未连接数据库或执行迁移。

## 审计结论

- **G0：保留。** Identity registration/member 操作需要创建或更新 `member.profile`；该 migration 是前述 direct table privilege 收回后恢复必要写路径的修复。
- [FACT][E-AU-618-001] 执行前要求 AU-617 exact predecessor、无 future head、profile relation/role 存在，且当前状态必须为 SELECT-only + 已存在 identity API `ALL` RLS policy；不接受未知 ACL 状态。
- [FACT][E-AU-618-002] 唯一 privilege delta 是 INSERT/UPDATE；assert 保证 SELECT/INSERT/UPDATE 存在，同时 DELETE/TRUNCATE/REFERENCES/TRIGGER 仍被拒绝，RLS 必须启用。
- [FACT][E-AU-618-003] IdentityRegistrationApi 注册 IdentityOperatorMemberModule，runtime compatibility 也要求 member.profile relation；因此它是可追溯的运行修复，不是任意 privilege 扩大。

## 未验证项

- 未在数据库验证 profile create/update 的同/跨 scope RLS 与 delete deny；既有 `zhudatuanidentityapi` ALL policy predicate 未在本 migration 内重定义。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；后续 profile policy 变动必须独立验证 INSERT/UPDATE 与 DELETE 的反事实。
