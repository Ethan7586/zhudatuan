# AU-309｜Compatibility 订单支付授权审计证据

该 migration 在既有订单创建和内部支付事实写入外，增加同一数据库事务内的 membership 授权证据审计行。订单或支付 RPC 返回成功后，按订单资源和幂等键去重写入 `audit_logs`；服务端路由将实际授权决策的 membership、角色、权限及 scope evidence 传入，浏览器角色无权直接执行 RPC。

后续 `member_identity_assurance` migration 已以 `create or replace` 延续这两个函数，并增添手机保证与订单资格证据；故本文件是不可删除的历史版本链，而不是遗留重复实现。当前订单、支付和购物车闭环已在 AU-302 的调用链中再次核验。

未发现新增 P0–P3 问题；因审计工作树缺少 Vitest 依赖，未执行定向测试。
