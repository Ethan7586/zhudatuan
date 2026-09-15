# RV-0029｜库存单一事实源切换独立复核

- 复核日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应候选：GX-0007
- 结论：**维持 GX，禁止删除、改写或单独重放；未发现 P0。**
- 方法：深读切换迁移，核验后继全域回填/退役与当前库存业务入口；未访问任何数据库或库存数据。

## 切换责任

迁移锁定遗留库存、订单和新库存表，先将legacy数量迁入`inventory.stock_items`并标为`manual_review`。只有无遗留保留、无新reservation/movement且无进行中订单的项目才能自动转为`ready`；其余必须经Owner受权的物理盘点复核。切换review不可变并有审计记录。

迁移在删除`public.inventory`前fail-closed：若任何项目仍需人工复核则中止。它不是兼容视图或双写方案，而是不可逆数据切换。

## 后继链与当前运行

全域回填将早期`stock_items/reservations/movements`映射到当前`inventory.stockitem/reservation/movement`模型；后续legacy退役迁移清除旧`public`对象及早期库存切换对象。当前`InventorySyncJobProcessor`在退货回库时查询并更新`inventory.stockitem`与`inventory.movement`，表明后继模型仍有真实Worker职责。

因此早期切换文件承担历史来源、审核和转移语义；后继删除不使其变成可安全删除的“无用文件”。

## 裁决与未知项

维持GX。未读取生产migration ledger、manual-review遗留、库存与预留对账、供应商快照、备份或恢复演练，不能证明切换历史是否完整；这些是删除/重放前必须专项核验的外部事实。审计分支不触碰迁移、库存或运行状态。
