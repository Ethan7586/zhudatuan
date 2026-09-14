# AU-626｜Publish Mall Provisioning

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260901223000_publish_mall_provisioning.sql`（44 行）。
- 审阅方式：逐行人工审阅 operation/permission/capability/entitlement/role mapping 的发布链；交叉检查 ProvisioningOperations、模块注册、专用 API runtime contract 与 CreateMall 的写入前置条件。未连接数据库、启动服务或执行测试。

## 审计结论

- **G0：保留。** 此 migration 将已实现的 `provisioning.malls.create` 写入入口公开为 platform owner 可用的受控 capability，而非直接赋予 provisioning runtime 一般业务域写入权。
- [FACT][E-AU-626-001] operation 精确注册为 `POST /api/v1/provisioning/malls`，capability 映射到 critical `organization.layer.manage` 且 audience 为 operator；platform-root entitlement 是唯一启用点。
- [FACT][E-AU-626-002] migration 仅删除 platform owner 对该 permission 的 deny，并幂等加入 allow；assert 从该 owner membership 的实际 effective operation 集合确认 entitlement/role/capability 链闭合。
- [FACT][E-AU-626-003] 应用入口先走 AccessPipeline，随后对 code/public slug、parent 与冲突做验证和 advisory lock preflight；模块声明只依赖 organization/catalog/experience，专用 provisioning runtime 也将业务域表权限列为 forbidden。

## 未验证项

- 未在隔离数据库验证该 owner membership 在不同 scope、已存在 allow/deny 或缺少初始 owner fixture 时的迁移结果；未发起真实 HTTP 请求或创建 mall。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；后续变更此 critical permission 时，必须以 platform owner、非 owner 与失效 entitlement 三种身份做 API/数据库反事实验证。
