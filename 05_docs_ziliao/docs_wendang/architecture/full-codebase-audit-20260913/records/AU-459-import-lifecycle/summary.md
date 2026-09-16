# AU-459｜目录与库存批量导入生命周期

- 主审 `20260821052000_import_lifecycle.sql`（125 行），并人工反查 catalog/inventory 导入操作、持久化适配器与 Worker；未执行导入、迁移、对象访问或线上查询。
- 目录导入获得游标、验证摘要、失败/报告状态和 scope 化错误；库存引入同构的 job/row/error 模型。约束限制总行数、进度、报告哈希/大小和错误长度；迁移断言进度不倒退。
- 暂存 row 仅授予后台 job 身份，应用会话仅按 scope 管理 job/错误。导入 Worker 分片处理、使用 savepoint 隔离单行失败，落进度/报告并通过 runtime job 调度。
- **G0**：Catalog 与 Inventory 的 API/Worker 运行链使用这些对象。**GX-0018**：历史导入状态、暂存数据与恢复边界迁移，禁止删除、改写或单独重放。未发现新增 P0–P3；未验证实际对象、重试、RLS 与恢复演练。
