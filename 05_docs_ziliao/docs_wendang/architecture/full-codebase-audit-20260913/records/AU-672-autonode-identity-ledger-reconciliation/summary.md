# AU-672｜Autonomous Identity Migration Ledger Reconciliation

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260909062500_reconcile_autonode_identity_migration_ledger.sql`（82 行）。
- 审阅方式：结构性审阅。核对 AU-671 schema/ACL marker、Supabase migration ledger 的精确记录与 RegistrationMigrationRunner 的 managed-repair guard；未重复深读供给函数本体，未执行迁移。

## 审计结论

- **G0：保留。** 该迁移不改变业务 Realm 数据；它补齐已经按字节执行的 AU-671 在 Supabase ledger 中缺失的记录，防止后续 runner 将实际存在的 schema 误判为未执行。
- [FACT][E-AU-672-001] 对账前要求 AU-671 runtime marker、nodeprovisioning/RLS、两个供给函数以及最小 execute privilege 均已精确存在；ledger 中若已有不匹配 name/statements 则 fail closed。
- [FACT][E-AU-672-002] RegistrationMigrationRunner 只有在同一 runtime checksum 与完整供给边界都已核实时才 defer 至 managed repair；任一 marker 或 ACL/RLS 漂移都会抛 `REGISTRATION_MIGRATION_AUTONODE_LEDGER_RECOVERY_INVALID`。
- [FACT][E-AU-672-003] 非主 registration database 的空 statements 容忍仅用于受控测试/非主环境路径；生产 migration role 仍要求完整预期 statements array。

## 未验证项

- 未读取实际 Supabase migration ledger，未知任何环境是否需要或已执行此对账。
- 未运行 runner managed-repair 路径，未验证其在 ledger conflict 时的实际退出行为。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（append-only migration ledger reconciliation）；不新增 G1/G2/G3/GX。
- 二次复核：否。
