# AU-404｜原子 checkout 与库存预留

`20260820125000_atomic_checkout_inventory.sql` 将旧 public checkout 入口收口为 `api_checkout_order_authorized`：验证 member、资格、地址、授权证据与幂等，在同一事务写订单、供应商子单、订单项、库存预留、审计及响应。它以 `inventory.reserve` 使支付前订单与库存占用原子化，任一库存或资格失败会整体回滚。

固定基线未找到该 service-role RPC 的仓内 HTTP/Worker 调用；Commerce 的现行 checkout 已是另一套领域模型和 Purchase API。该 RPC 仍是公共写入契约，并与后续库存支付/到期迁移及已应用订单数据相连，因此列为 DC-0062/G1，禁止删除。未发现 P0；未执行测试、数据库写入、构建或线上检查。
