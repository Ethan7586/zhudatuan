# AU-442｜legacy 数据库对象退役

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260821031000_drop_legacy_objects.sql`（33 行）。
- 交叉核对：前置回填/对账、后续 target-head 断言和数据库对象契约检查。
- 本批为静态迁移语义审阅；未执行数据库重放、删除、读取生产数据库或线上操作。

## 运行结论

迁移在单一维护窗口事务中清除敏感临时 stage 表、全部 legacy `public` 业务表/视图/序列与相关 fallback 函数，以及已由新库存模型承接的旧 inventory 表和函数。`CASCADE` 是有意设计：不允许依赖旧对象的触发器、策略、视图或 API 残留形成新旧双写或兼容回退。

紧随其后的 target-head 迁移显式失败于 legacy inventory、stage 表或 public API 函数仍存在；后续支付迁移和数据库契约脚本亦把旧 runtime 遗留视为错误。这些证明该文件属于已验证切换序列而非可任意移除的清理脚本。

## 审计结论

- GX：不可逆 legacy 数据库退役迁移。禁止删除、改写、单独重放或与功能变更混合。
- 真实 legacy 数据是否已完整回填、依赖是否均被新模型承接，需由隔离备份恢复、迁移 ledger、对账和回滚演练独立复核；本批保持未验证。
- 本批未新增 P0–P3。
