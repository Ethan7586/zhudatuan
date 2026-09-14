# AU-469｜Error contract 发布封板

- 主审 `20260821062000_publish_error_contract.sql`（16 行），并人工反查 `20260821032000_assert_target_head.sql`、相邻 `20260821063000_finalize_error_contract.sql` 与迁移执行账本；未执行迁移、数据库查询或线上验证。
- 文件不定义业务错误码或客户端错误响应；它将 target-head 的校验和固定为特定值，写入自身版本记录，并在不匹配时终止迁移，错误为 `RUNTIME_ERROR_CONTRACT_CHECKSUM_MISMATCH`。
- target-head 断言覆盖 schema 集合、operation/event registry 数量、capability 映射、遗留 public 对象清理、广泛 grant、RLS、`SECURITY DEFINER` search path 与 reconciliation evidence。因此该 checksum 是已发布数据库契约状态的迁移门禁，不是描述性注释或可重建构建产物。
- **G0**：`runtime.schemaversion` 迁移账本的历史链路依赖此版本记录。**GX-0028**：发布封板与数据库完整性迁移，禁止删除、改写、跳过或单独重放；需独立复核其与迁移执行器、目标数据库 head 的一致性。未发现新增 P0–P3；未验证实际库的校验和、迁移顺序及恢复演练。
