# AU-625｜Inventory Mall Identity

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260901222000_add_inventory_mall_identity.sql`（100 行）。
- 审阅方式：逐段人工审阅 reservation/movement 回填、失败条件、复合约束、inventory job scope 修正和 assertion；交叉检查 InventoryPort、InventorySyncJob、SQL 隔离契约、Internal Mall dataset writer。未连接数据库、执行迁移或运行种子工具。

## 审计结论

- **G0：保留。** 该 migration 为库存预留与流水建立 mall identity，使相同 stock/owner/reference 标识不能跨商城串联，并使库存异步退货任务按 return mall 执行。
- [FACT][E-AU-625-001] reservation/movement 均从 stockitem 的 `scope_id` 回填 mall，孤儿、null、跨 mall 不一致和旧/新业务键重复均 fail-closed 后才设 NOT NULL。
- [FACT][E-AU-625-002] stock `(scope_id,id)`、child `(mall_id,id)` unique 和 `(mall_id,stockitem_id)` composite foreign keys 使库存预留/流水只能指向同 mall stock；reservation 与 movement idempotency key 同时 mall-scoped。
- [FACT][E-AU-625-003] InventoryPort、StockImport 与 InventorySyncJob 的当前写入、锁定、状态更新和冲突键已均带 mall predicate；SQL contract 覆盖 cross-mall FK、重复 commit/release/return 与同 owner/reference 的跨 mall 隔离。
- [FACT][E-AU-625-004] inventorysync 任务以 return payload 关联 `fulfillment.returnrecord.mall_id` 回填 scope，运行 worker 也用 job mall 加载和写入。

## 关联问题

- **F-0265（P2，证据扩大）**：同一正式 Internal Mall 数据集除了 fulfillment 外，也以迁移前列集合写入 `inventory.movement` 和 `inventory.reservation`；迁移后两类写入都会因缺失 `mall_id` 失败。

## 未验证项

- 未在隔离数据库回放历史库存数据、跨 mall conflict 或 inventorysync job payload；未验证索引/约束建立耗时。
- 未执行 dataset/import 工具，F-0265 的实际失败回执尚未取得。

## 结论等级

- 新增独立问题：无；F-0265 证据扩大。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：F-0265 仍需独立复核；迁移本身无需二次复核。
