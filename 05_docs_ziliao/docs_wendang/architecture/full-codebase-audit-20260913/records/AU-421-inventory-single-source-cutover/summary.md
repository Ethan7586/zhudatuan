# AU-421｜库存单一事实源切换

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260820133000_inventory_single_source_cutover.sql`（982 行）。
- 交叉核对：注册迁移执行计划、库存单一事实源契约、订单/库存生命周期迁移及目录/供应商写入接口。
- 本批为静态调用链与迁移语义审阅；未执行数据库重放、构建或线上操作。

## 运行结论

迁移将库存权威切换到 `inventory.stock_items`、预留和 movement 模型：先锁 legacy 库存与订单相关表，迁移最终快照，只有无预留、无 movement、无活动订单关联的项目可自动变为 ready；其他项目进入 immutable cutover record 和受权人工复核。目录读取只展示 ready 库存，供应商同步遇到既有 StockItem 会 fail-closed 要求独立对账，从而避免无签名游标的快照覆盖本地库存变化。

受限状态/复核 API 需要平台范围、关键权限、授权证据、版本与幂等键。迁移还重写目录和供应商库存写路径、关闭测试维护接口，并删除 legacy `public.inventory`。注册迁移执行计划按原文执行，契约测试覆盖可售库存、手工复核、ACL 和 legacy 退出。

## 审计结论

- GX-0007：这是高风险不可逆数据切换，不是可清理代码。任何变更必须独立核验生产 ledger、库存/预留对账、手工遗留、供应商同步和恢复路径。
- 本批未新增 P0–P3；迁移未重放，运行数据状态未验证。
