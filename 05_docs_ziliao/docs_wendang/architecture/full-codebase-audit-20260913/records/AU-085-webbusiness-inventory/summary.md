# AU-085｜WebBusiness 库存读取运行入口深审

WebBusiness 只暴露 member `inventory.availability.read`。它验证 SKU 数量/长度和 keyset cursor，针对当前 access scope 的组织 closure 汇总每个 stockitem 的 `onhand-safety-active reservation`，由 `zhudatuanwebapi` 的 inventory select/RLS 读取。

与完整 Commerce 的同名 contract 比较后发现：完整 handler 要求 `access.mall_id` 且只查询该 mall；Web handler 不取 mall context，而是查询 `access.scope.id` 的 descendant scope。该差异没有出现在 SDK/operation contract，也没有等价性行为测试，记录为 F-0160/P2。

未发现 P0；未运行 Vitest、未改变代码、数据库或运行状态。
