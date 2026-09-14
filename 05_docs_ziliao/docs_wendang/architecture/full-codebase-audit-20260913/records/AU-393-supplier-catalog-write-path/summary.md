# AU-393｜供应商目录写入

`20260819110000_supplier_catalog_write_path.sql` 首次建立外部 SPU/SKU 唯一键和批量目录写入：输入限制 1–100 项，按商城/来源/幂等键串行，写产品、SKU、库存、供应商和审计日志。它不接受凭据字段，供应商凭据边界保持在数据库外。

当前实现已由 `20260820133000_inventory_single_source_cutover.sql` 重定义：写入前锁定 admin membership，要求 `product.publish`、`price.update` 和 `inventory.update` 权限及授权证据；库存转为 `inventory` schema 的单一事实源。若既有库存项尚未完成切换，函数拒绝更新商品数据、记录待协调观测和失败同步状态，而不是覆盖库存。固定基线的库存 cutover 契约测试直接覆盖成功同步、陈旧快照阻断及副作用边界。

初版迁移仍承担 schema 建立和历史兼容责任，现行函数及其测试证明该链为 G0，不是删除候选。未发现新增 P0–P3；未执行测试、数据库写入、构建或线上检查。
