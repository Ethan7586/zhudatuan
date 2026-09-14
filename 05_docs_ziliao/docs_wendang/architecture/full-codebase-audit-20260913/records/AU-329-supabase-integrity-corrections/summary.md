# AU-329｜Supabase 基础完整性校正

该前向迁移把用户身份主体唯一键从 `unique nulls not distinct` 调整为普通 `(tenant_id, identity_subject)` 唯一性，并补上内部账户支付的 payment-allocation 事实。支付仍在一条事务内锁定订单和对应账户、以余额条件更新防止透支、写账本/支付/分配/订单状态/审计和幂等响应。

该原始支付函数后来被身份保障包装器调用，并从 service role 撤销直接执行权；当前外部入口不直接使用此版本。未发现新增 P0–P3 或删除候选；文件保留数据完整性和前向重放职责，结论为 G0。
