# AU-151｜Inventory 库存、导入与 Worker 运行链深审

InventoryPort 按 stock lock、active reservation 与 safety 执行 reserve/commit/release；movement 以 mall/stock/kind/reference 幂等。Inventory import 将 CSV 经 500 行 staging、逐行 savepoint、continuation/report 完成；sync worker 对已接受退货按 job mall restock。

新增 F-0181/P2：导入/HTTP/worker 组合没有直接行为测试。未发现 P0。
