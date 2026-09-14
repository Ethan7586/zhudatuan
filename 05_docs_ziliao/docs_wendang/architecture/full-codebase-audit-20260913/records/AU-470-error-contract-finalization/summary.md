# AU-470｜Error contract 最终封板

- 主审 `20260821063000_finalize_error_contract.sql`（16 行），并对比紧邻 `20260821062000_publish_error_contract.sql`、`20260821032000_assert_target_head.sql` 与迁移账本使用方式；未执行迁移、数据库查询或线上验证。
- 该文件与 AU-469 的发布步骤同样固定 target-head checksum、登记自身迁移版本，并在 checksum 不匹配时以 `RUNTIME_ERROR_CONTRACT_CHECKSUM_MISMATCH` 中止。两者的版本登记不同，不能将源码文本相似误判为可删除副本。
- 它的实际职责是维持顺序迁移 ledger 的连续性；目标断言涵盖 schema、operation/event、capability、RLS、grant、遗留对象与 reconciliation 状态。
- **G0**：该版本记录是既有迁移序列的必要历史事实。归并至 **GX-0028**：发布封板与数据库完整性迁移，禁止删除、改写、跳过或单独重放；需独立复核与迁移执行器、目标数据库 head 的一致性。未发现新增 P0–P3；未验证真实 migration ledger、顺序执行和恢复演练。
