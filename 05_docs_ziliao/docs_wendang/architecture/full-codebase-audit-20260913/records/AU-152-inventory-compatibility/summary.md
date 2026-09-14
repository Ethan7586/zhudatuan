# AU-152｜Inventory compatibility 与覆盖闭合深审

七个 Inventory root/legacy 路径都单向转发已审 canonical implementation。根 `InventoryModule` 是 Commerce main 的 stable import；legacy import/sync job path 被主 jobs catalog 实际使用。

全部为 G0。Inventory 20/20 基线文件已有审阅状态；未发现 P0–P3 新问题。
