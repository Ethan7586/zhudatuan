# AU-331｜Supabase 订单读模型

`20260724101500_order_read_model.sql` 建立了仅向 `service_role` 授权的 `api_order_views`：按租户、企业、商城和用户精确过滤订单，并返回订单金额、支付分配、商品快照与按下单时间倒序的项目列表。它不写数据、不注册路由或任务；作为迁移，仍承担历史数据库重放责任。

固定基线中未发现仓内代码调用旧 `api_order_views`。后续 `20260810130000_admin_operations_real_write_path.sql` 另建支持管理范围读取的 `api_order_views_scoped`，且当前 Commerce API 的订单与后台概览入口实际调用后者（`orderRoutes.ts:52`、`adminRoutes.ts:31`）。旧函数并未被后续迁移撤销，仍保留 `service_role` 执行权限；外部服务、历史制品或直接数据库消费者尚未排除。因此记录为 DC-0049 / G1，而非删除候选或缺陷事实。

未发现新增 P0–P3。未运行迁移或数据库验证，以避免写入数据库；上述调用关系为固定基线静态证据。
