# AU-599｜当前运行时契约 Checksum 对齐

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260829201000_reconcile_current_contract_checksum.sql`（61 行）。
- 审阅方式：逐行人工审阅 contract catalog fingerprint、checksum 更新、schema marker/assert；交叉检查 generated contract checksum 和所有 API/Worker runtime compatibility 消费方。未连接数据库或执行迁移。

## 审计结论

- **G0：保留。** 此 migration 将 runtime contract checksum 与实际 operation/capability/event catalog 的三份完整哈希绑定，是所有 API/Worker 启动兼容性读取 `runtime.schemaversion` 的关键历史收敛点。
- [FACT][E-AU-599-001] 在更新 checksum 前，SQL 以排序后聚合的完整字段串分别计算 `runtime.operation`、`capability.operation`、`runtime.event` SHA-256；任一 catalog 与固化 fingerprint 不符即抛出 `RUNTIME_CONTRACT_CATALOG_FINGERPRINT_MISMATCH`。
- [FACT][E-AU-599-002] 只有三个 catalog fingerprint 全部匹配后才更新 `20260821032000` marker，并要求目标 version 行存在；最终断言确认该 checksum 和本 migration marker。因此比 AU-597 的无旧值 guard 更能检测实际 catalog 漂移。
- [FACT][E-AU-599-003] RuntimeCompatibility 以及 Identity、Web、Purchase、Console、Catalog、Payment 等 API/Worker 在真实启动检查中消费 generated `RUNTIME_CONTRACT_CHECKSUM`。该迁移不能删除或仅当作 release 注释。
- [FACT][E-AU-599-004] 本文件将完整目录 fingerprint 作为前置条件，降低 F-0262 在后续 head 被未知 catalog 状态掩盖的风险；但不会改变 AU-597 本身缺少旧 checksum guard 的历史事实。

## 未验证项

- 未执行已知匹配、额外 operation、字段变更、空 catalog 或 checksum 行缺失的迁移路径；未验证真实数据库已达该 marker，或每个运行单元会在 mismatch 时 fail closed。

## 结论等级

- 新增问题：无。关联 F-0262（P2）。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；若变更 contract generation 或 migration 策略，应以隔离数据库验证三种 catalog fingerprint 的反事实失败。
