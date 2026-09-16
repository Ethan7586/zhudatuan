# AU-405｜库存、支付与到期协同

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260820126000_inventory_payment_expiry.sql`。
- 交叉核对：`20260820127900_payment_expiry_guard.sql`、库存与支付效果处理器契约测试、后续调用点。
- 本批为静态调用链与迁移语义审阅；未执行数据库重放、构建或线上操作。

## 运行结论

`inventory.commit_payment` 先锁订单，再按稳定顺序锁库存和预留记录；它拒绝已释放、已到期、缺失或部分提交的预留，并在数量与订单项一致后委托 `inventory.commit`。这使支付、超时回收和终端支付事件采用同一订单优先锁顺序。

受权入口 `api_pay_internal_authorized` 在写入账户扣款、支付及分摊前验证成员锚点、自身范围、`order.create` 权限、授权证据和已验证手机号。订单变为 `paid` 后，同一事务调用库存提交；幂等键、订单咨询锁和审计记录覆盖重复请求与可追溯性。历史 `api_pay_internal` 被移除，新入口仅授予 `service_role`。

后续 `api_expire_due_checkout_orders` 仅对没有未终态微信支付尝试证据的到期订单调用 `inventory.expire`，再取消订单和子订单并写审计记录。契约测试及支付效果处理器均继续使用该库存提交/到期语义。

## 审计结论

- G0：该迁移是库存、内部支付和到期回收的一致性边界，不是删除候选。
- 本批未新增 P0、P1、P2 或 P3；未运行验证均已明确保留为未验证状态。
