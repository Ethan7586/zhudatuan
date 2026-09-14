# AU-632｜Owner Identity Runtime Boundary

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260902135000_owner_identity_runtime_boundary.sql`（92 行）。
- 审阅方式：逐段人工审阅 function definition rewrite、ACL 转移与 leak assertion；交叉检查 AccessPort/AccessOperations、IdentityRegistrationApi selected module/operation set、WebBusiness API module set和服务入口资料。未连接数据库、执行迁移或调用 owner transfer。

## 审计结论

- **G0：保留，但存在 P2 权限与入口断链。** migration 对五个 owner identity function 进行严格 definition rewrite，将 legacy `shopapp` caller guard 与 execute privilege 收敛至 `zhudatuanidentityapi`，并针对所有已知 runtime role 断言未泄漏。
- [FACT][E-AU-632-001] rewrite 对每个目标 function 要求恰有两处 legacy role literal，替换后要求零 `shopapp`、恰两处 identity API literal，避免静默部分替换；随后 revoke 所有其它 runtime role 的 execute。
- **F-0267（P2）**：调用方没有随数据库权限迁移。AccessOperations 的 ownership transfer create/cancel 仍经 AccessPort 直接调用被 revoke from shopapp 的 functions；IdentityRegistrationApi 只装载 Access read module/operation set，不装载 AccessOperations；WebBusiness API 也不装载 access module。现有运行入口无法承接该迁移后的写调用。

## 未验证项

- 未以各 runtime database role 执行 owner transfer；F-0267 未取得 permission-denied 回执。
- 未确认历史 full Commerce `ApiMain` 是否仍有独立未纳入当前 systemd 架构图的运行单元，故不将影响扩展为线上中断事实。

## 结论等级

- 新增问题：P2 1 项（F-0267）。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：F-0267 需要；复核者必须重追所有公网 owner transfer routes、实际服务 unit、module set 和对应 DB role privilege。
