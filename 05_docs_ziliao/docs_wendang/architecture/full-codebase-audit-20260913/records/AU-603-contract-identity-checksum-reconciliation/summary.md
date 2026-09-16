# AU-603｜身份契约 Checksum 对齐

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260829213000_reconcile_contract_identity_checksum.sql`（64 行）。
- 审阅方式：逐行人工审阅 database/version/checksum guard、受限更新、marker/assert；交叉检查 registration migration plan 与 API/Worker runtime compatibility 消费方。未连接数据库或执行 migration。

## 审计结论

- **G0：保留。** 此迁移以 fail-closed allow-list 方式将 identity/owner contract checksum 收敛到现行值，是运行时兼容性链的历史环节，不能删除。
- [FACT][E-AU-603-001] 执行要求独立 registration database、AU-602 精确 predecessor、没有 unknown future head；旧 contract checksum 只能是三个明确已知值之一，否则失败。
- [FACT][E-AU-603-002] UPDATE 只把两个已知旧值推进到 target；target 值保持不变以支持 idempotent replay。最终 assert 同时验证 contract 与 migration marker。
- [FACT][E-AU-603-003] RegistrationMigrationPlan 将该 migration 纳入受控 backfill，全部 API/Worker startup compatibility 读取同一个 generated `RUNTIME_CONTRACT_CHECKSUM`；这是实际启动依赖而非孤立 SQL 说明。

## 未验证项

- 未执行 known-old、already-target、third-known-old、unknown/missing checksum 或 future-head 的数据库路径；未验证真实实例当前 marker。

## 结论等级

- 新增问题：无。关联 F-0262（P2）。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；后续 contract checksum 改动须保持明确 predecessor allow-list 和未知值回滚验证。
