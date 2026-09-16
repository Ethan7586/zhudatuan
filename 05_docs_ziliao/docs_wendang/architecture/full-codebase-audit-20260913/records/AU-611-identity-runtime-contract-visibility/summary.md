# AU-611｜Identity 运行时契约可见性

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260830103000_identity_runtime_contract_visibility.sql`（58 行）。
- 审阅方式：逐行人工审阅 database/head/checksum guard、runtime contract update、identity role RLS policy 与 assertion；交叉检查 Identity API/Job runtime compatibility 与 RegistrationMigrationRunner。未连接数据库或执行迁移。

## 审计结论

- **G0：保留。** 此 migration 将 identity runtime 所需的 contract marker 纳入 `zhudatuanidentityapi` 对 `runtime.schemaversion` 的可见 RLS 集合，并以精确 checksum 更新 contract marker。
- [FACT][E-AU-611-001] 仅在 registration database/migration role 或超级用户、AU-610 精确 predecessor、无 future head 且 invitation marker 完整时执行；未知 history fail closed。
- [FACT][E-AU-611-002] contract checksum update 明确限定已知旧值，未采用 F-0262 所述无条件覆盖模式；RLS policy 仅添加 four named versions，不开放全表。
- [FACT][E-AU-611-003] Identity registration API 与 notification job 在启动 compatibility query 中读取 schema/contract/registration/invitation markers；缺少其中任一 marker 会使 runtime 拒绝启动，因此该 RLS migration 是真实运行依赖。

## 未验证项

- 未以 identity API/job role 查询真实 RLS、验证启动失败路径或执行 checksum update；线上 marker 与 policy 版本未验证。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；后续 identity startup marker 变动应同批验证 RLS allowed-version 集与 runtime query。
