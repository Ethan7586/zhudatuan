# AU-466｜Runtime contract head 对账

- 主审 `20260821059000_reconcile_contract_head.sql`（16 行），并反查 schemaversion 的后续迁移/运行就绪消费者；未执行迁移或部署检查。
- 迁移封板 AU-465 后的 runtime contract checksum，写入自己的 migration ledger，并在同事务内强制校验目标值。
- 后续 runtime readiness、migration sequence 和发布相关迁移均将 schemaversion 作为顺序与一致性证据，因此文件不能因不含应用代码而删除。
- **GX-0025**：部署/恢复契约 ledger，禁止删除、改写或单独重放。未发现新增 P0–P3；未验证目标数据库、完整迁移序列与发布恢复。
