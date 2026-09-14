# AU-390｜管理端订单分页

`20260818210000_admin_order_management_pages.sql` 提供订单与售后只读分页：按 tenant、enterprise、mall 和可选用户过滤，限定页大小为 1–100，以时间/金额和 ID 形成稳定排序，并投影订单支付、商品和供应商摘要。初版通过 service-role 执行；`20260819123000_admin_order_line_count.sql` 修正 line count，`20260820122000_admin_order_query_export_authorization.sql` 撤销底层函数的 service-role 权限，改由重验 membership、角色、权限、会话授权证据和经营范围的包装 RPC 调用。

因此底层分页函数不是孤立的“旧页面”：当前授权包装器直接调用它，数据库契约测试覆盖授权成功、拒绝与底层权限收紧。固定基线未见应用层直接使用此 SQL 函数，符合其被服务端包装、而非浏览器直连的设计。未发现新增 P0–P3 或删除候选；未执行测试、数据库写入、构建或线上检查。
