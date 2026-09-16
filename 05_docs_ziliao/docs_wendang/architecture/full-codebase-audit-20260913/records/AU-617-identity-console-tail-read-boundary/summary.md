# AU-617｜Identity Console Tail 读取边界

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260831130000_identity_console_tail_read_boundary.sql`（99 行）。
- 审阅方式：结构性审阅；与 AU-615 比对 read-boundary 模式，逐行检查 relation set、RLS policy 差异、IdentityRegistrationApi 模块注册。未连接数据库或执行迁移。

## 审计结论

- **G0：保留。** IdentityRegistrationApi 确实注册 Experience、Notification、Qualification 等 operator read modules，迁移提供相应 read projection。
- [FACT][E-AU-617-001] 迁移绑定 AU-616 predecessor、拒绝 future head，只授予 18 张表 SELECT 并撤销所有写权限。
- [FACT][E-AU-617-002] 对 catalog import、experience、invoice、member import、notification 与 qualification 等 16 relation 动态创建 `identityapiread using (true)`；这与 AU-615 相同，扩大 F-0264 的 relation 覆盖范围。
- [FACT][E-AU-617-003] voucher import relation 被 grant/select assert 检查，但不在动态 policy loop；其最终可见性取决于既存 voucher RLS policy，未在本单元重复断言其 predicate。

## 未验证项

- 未以 identity API role 验证上述 18 relation 的同/跨 scope row visibility，也未复核每个 API query 的 scope predicate。

## 结论等级

- 新增问题：无（F-0264 增补证据）。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：是；与 F-0264 一并按 relation owner scope 重审。
