# AU-569｜Storefront Compatibility MVP 目录扩充迁移

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260724090000_expand_mvp_catalog.sql`（117 行）。
- 审阅方式：逐行人工审阅商品、SKU、库存写入及 UPSERT 更新面；定向比对 Canonical 同名迁移、后续目录/读模型 migrations 和历史 ledger。未运行数据库 replay。

## 审计结论

- **G0**：该迁移为 Compatibility demo mall 的可重放目录 fixture，补入 8 个跨 food/appliance/digital/virtual-card 类目的 active product、SKU 和库存记录；`api_catalog` 和后续 catalog governance/read model 需要这些真实的起始实体来验证目录/下单链路。没有删除依据。
- [FACT][E-AU-569-001] 每个 product/SKU/inventory 写入以稳定 ID 与 `on conflict` 收敛；产品更新限于展示及状态字段、SKU更新限于 specs/价格/状态、库存更新只写 `available_qty` 与时间，未改变 tenant/mall/supplier/product 归属。
- [FACT][E-AU-569-002] Compatibility 与 Canonical 同名迁移 SHA-256 完全一致，但 AU-288 的隔离边界仍成立：两套 migration ledger 不能混跑。
- [FACT][E-AU-569-003] 后续 catalog governance、catalog pool 和 admin catalog migrations 继续读取/治理 products、skus、inventory；本迁移无静态应用调用者是 migration-ledger 的正常触发方式，不构成闲置证据。

## 边界与未验证项

- `on conflict` 使将来在同一数据库重新执行此 SQL 时会把这 8 个 SKU 的可用库存重设为 fixture 值；正式 migration ledger 正常情况下不会重放已记录版本。未发现仓内部署脚本会对已有数据库单独重跑此文件，未将该受控 reset/replay 行为报为运行缺陷。
- 图片均为外部 Unsplash URL；未验证其许可、线上 CSP、可用性、缓存或是否已被后续 media domain boundary 迁移替代。
- 未核验远端 Compatibility 数据库是否仅用于测试、是否已有真实订单引用这些 SKU，亦未做 migration replay 或商品/库存并发反事实。
