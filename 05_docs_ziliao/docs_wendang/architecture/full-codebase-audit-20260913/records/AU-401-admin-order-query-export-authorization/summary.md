# AU-401｜管理端订单查询与导出授权

`20260820122000_admin_order_query_export_authorization.sql` 将订单和售后分页/导出收口为 service-role 授权包装器：验证 admin membership、动作权限、会话授权证据、经营范围和 self-scope；导出同时要求 critical `order.export`，在同一事务写入审计，并拒绝超过 5,000 行的结果。底层读取函数和旧审计函数被撤销 service-role 直接执行权限。

数据库契约测试覆盖允许、拒绝、self-scope、导出审计和 ACL 状态。固定基线未见 Commerce API、Console 或 Worker 调用这两个公开包装器，因此接口归 DC-0061/G1，不能在未核验仓外消费者与实际 ACL 前删除。未发现新增 P0–P3；未执行测试、数据库写入、构建或线上检查。
