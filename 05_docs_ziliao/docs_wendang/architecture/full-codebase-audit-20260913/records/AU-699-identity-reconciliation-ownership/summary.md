# AU-699｜Identity Reconciliation 函数所有者恢复

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260912181000_restore_identity_reconciliation_function_ownership.sql`（12 行）。
- 审阅方式：结构性审阅。核对三个 function 的调用者、前序 reconciliation 与后续 `20260912240000`/`20260913012500`/`20260913013500` 的 owner/execute 演进。

## 审计结论

- **G0：保留为迁移演进节点。** 本 migration 将 reconciliation 临时由 `shopmigration` 拥有的 Realm-account、active membership context 与 member target projection function移交 `zhudatuanroot`。
- [FACT][E-AU-699-001] 这些 function 是身份 session、membership context、registration projection 的真实运行依赖；但当前基线随后又重建/恢复了 session/context function 的 owner 与 execute boundary，因此本 12 行不是现行权限模型的唯一来源。
- 不新增独立 finding；最终 session/permission read boundary由后续 AU 单元深入审阅。

## 未验证项

- 未读取生产 `pg_proc.proowner`/`information_schema.role_routine_grants`，不能断言线上 owner状态。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（Identity reconciliation ownership evolution）；不新增 G1/G2/G3/GX。
- 二次复核：否；任何删除/回滚必须连同后续 owner/execute restoration migrations审阅。
