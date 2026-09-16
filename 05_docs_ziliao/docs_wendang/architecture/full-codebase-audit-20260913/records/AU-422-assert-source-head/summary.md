# AU-422｜迁移源头断言

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260821010000_assert_source_head.sql`。
- 交叉核对：数据库合同审计器的迁移序列配置。
- 本批为静态迁移语义与调用关系审阅；未执行数据库重放或线上操作。

## 运行结论

该迁移在事务中验证 `supabase_migrations.schema_migrations` 存在，并对截至 `20260820133000` 的固定迁移集合双向比对：缺失版本和意外历史版本都会终止执行。随后断言 `users`、`orders` 和 `inventory.stock_items` 等关键对象已存在。数据库合同审计器将该文件列入受控执行序列。

## 审计结论

- G0：这是后续 domain schema 演进的迁移完整性前置条件，不是删除候选。
- 本批未新增 P0–P3；未重放迁移，运行 ledger 状态未验证。
