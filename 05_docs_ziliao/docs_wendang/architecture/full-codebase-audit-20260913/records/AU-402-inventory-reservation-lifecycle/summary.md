# AU-402｜库存预留生命周期

`20260820123000_inventory_reservation_lifecycle.sql` 建立 `inventory` 单一事实源：库存项、命令幂等账本、预留、不可变 movement、观测、同步状态和历史 cutover 记录。`reserve`、`commit`、`release`、`expire`、`restock` 以锁定顺序和状态机维护可用量；历史 `public.inventory` 只导入为 manual-review，不被视为有效预留账本。

后续原子 checkout、支付、过期守卫和 payment observation 迁移直接调用这些命令；`inventory_reservation_lifecycle_contract.sql` 及相关支付/过期契约覆盖重放、超卖拒绝、提交前支付条件、释放、到期和状态不可逆。该链为 G0，不是删除候选。

未发现新增 P0–P3；未执行测试、数据库写入、构建或线上检查。
