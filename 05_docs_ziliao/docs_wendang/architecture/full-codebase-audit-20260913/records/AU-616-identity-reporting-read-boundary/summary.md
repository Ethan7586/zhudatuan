# AU-616｜Identity Reporting 读取边界

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260831120000_identity_reporting_read_boundary.sql`（62 行）。
- 审阅方式：结构性审阅；对比 AU-614/AU-615 的 read-boundary 模式，检查两表 schema、RLS 差异、IdentityOperatorReportingModule 和实际查询。未连接数据库或执行迁移。

## 审计结论

- **G0：保留。** IdentityRegistrationApi 注册 reporting operator read module，需读取 fact 与 metric。
- [FACT][E-AU-616-001] `reporting.fact` 使用 `access.scope_allowed(scope_id)`，实际 operator query 也以 `fact.scope_id=$1` 过滤。
- [FACT][E-AU-616-002] `reporting.metric` 的主键是全局 metric/version，只有名称、定义、单位和维度，不含 scope 或业务事实；其 `using(true)` 仅公开指标定义，不构成 F-0264 型跨 scope row exposure。
- [FACT][E-AU-616-003] 两表均只授予 identity API SELECT，显式撤销写权限，并以 exact predecessor/future-head/relation guards 约束迁移执行。

## 未验证项

- 未以 identity role 验证 fact 跨 scope 拒绝或 metric 只读访问。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；metric 如将来引入 scope/tenant 事实字段，必须替换 permissive policy。
