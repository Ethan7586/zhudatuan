# AU-763｜数据库对象合同生成器

- 审阅范围：`build-database-object-contract.mjs`、其 `objects.yml` 输出及静态消费者。
- 审阅方式：深入审阅 migration scan、对象状态维护、rename/move/drop、partition/trigger/policy、grant/revoke/default policy 规则和输出写入；反向核对 callgraph、JourneyHarness、database-contracts、provisioning/deployment 与 P0 verifier consumers。
- 验证：未运行。该脚本会重写受控 `02_platform_pingtai/database/contracts/objects.yml`，不符合审计分支只写报告的边界。

## 审计结论

- **G1 / DC-0083：** 生成器未见正式仓内启动入口，但输出是多个质量/发布检查的真实输入，不能按无用脚本删除。
- 它是 migration-source 的词法/规则化投影，不是 PostgreSQL live catalog：对动态 SQL、复杂函数签名、非标准 DDL、实际 role inheritance/RLS/constraint/index 状态的结论必须由 isolated replay 或只读 production catalog 复核。
- 当前对象清单约 30,299 行；生成器只扫描从 `20260821011000_create_domain_schemas.sql` 起的 migration，并以 hard-coded caller map、drop table set 和默认 access grant/policy 规则补足对象语义。权威范围与再生成责任尚未确认。
