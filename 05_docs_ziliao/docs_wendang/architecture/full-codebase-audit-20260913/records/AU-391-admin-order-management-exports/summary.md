# AU-391｜管理端订单导出

`20260818211000_admin_order_management_exports.sql` 为订单和售后提供独立于分页的导出读取器，按同一经营范围和筛选规则排序，并将读取上限限定为 5001 行；初版另有导出审计写入函数。后续 `20260819123000_admin_order_line_count.sql` 统一订单行数投影，`20260820122000_admin_order_query_export_authorization.sql` 撤销三个底层函数的直接 service-role 权限。

现行授权包装器先验证 membership、操作者、critical `order.export` 权限、会话授权证据与范围，再调用相应导出函数；它在同一数据库事务写入含筛选条件、行数和结果状态的审计记录，并拒绝超过 5000 行的结果。数据库契约测试明确断言底层函数不可被 service role 直接执行。故这些底层接口仍为当前受控链路的一部分，不是删除候选。未发现新增 P0–P3；未执行测试、数据库写入、构建或线上检查。
