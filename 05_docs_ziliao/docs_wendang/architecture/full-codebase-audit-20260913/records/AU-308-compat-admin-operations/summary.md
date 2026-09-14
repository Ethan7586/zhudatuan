# AU-308｜Compatibility 管理运营真实写入链

管理目录、订单视图和售后计数均在数据库按 tenant、enterprise、mall 取数；服务路由先以服务端 membership 做 `catalog.read` 或 `order.read` 授权。窄供应商等 scope binding 无法匹配默认 mall 资源上下文，因而不能单独通过该粗粒度授权并取得全 mall 订单；具有 mall/enterprise/tenant 匹配范围的成员取得相应聚合视图。

商品上下架和订单发货均先读取服务端资源范围，再以精确 scope 做授权。数据库 mutation 使用同 mall、动作与幂等键的事务 advisory lock，冲突请求哈希拒绝，首次写入同时保存响应、前后状态及 membership 授权证据到审计日志；订单发货还锁定订单并限制状态为 paid/processing。路由测试覆盖无权限时不访问数据库、后台 target 隔离及概览权限边界。

未发现新增 P0–P3 问题。因审计工作树缺少 Vitest 依赖，未执行相关测试；结论基于迁移、路由、授权库和测试的静态调用链取证。
