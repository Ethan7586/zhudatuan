# AU-480｜控制台契约发布封板

- 主审 `20260821073000_publish_console_contract.sql`（16 行），并人工反查 runtime schema ledger、后续 console 专用运行单元的 schema/version 依赖和 Console 前端的 API request 约定；未执行迁移、构建、服务或线上查询。
- 文件仅更新 target-head checksum、登记自身 migration version，并在不匹配时以 `RUNTIME_CONTRACT_CHECKSUM_MISMATCH` 中止。它不生成 Console 前端制品，也不直接注册路由或授予权限。
- Console 前端以 server-issued session access version、scope 和 generated operation client 发起请求；后续 ConsoleSupportRuntime/专用数据库角色会检查 `runtime.schemaversion`、operation registry 与最小权限。因此此 checksum 是控制台契约变更进入数据库发布历史的封板点。
- **G0**：迁移 ledger 版本与 checksum 是现有发布/兼容性验证的历史事实。**GX-0036**：控制台 API/授权契约发布封板，禁止删除、改写、跳过或单独重放；需独立复核目标 database head、runtime readiness 和前后端 operation 兼容性。未发现新增 P0–P3；未验证实际 console artifact、生产角色或迁移恢复流程。
