# AU-593｜筑大团注册运行时就绪修复

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260828183000_zhudatuan_runtime_readiness_repair.sql`（104 行）。
- 审阅方式：逐行人工审阅事务、数据库/版本 guard、contract checksum 迁移、schema ledger RLS policy 与最终断言；交叉检查 Identity Registration API、Identity Notification Worker 和 Purchase deployment 验证入口。未连接数据库或执行迁移。

## 审计结论

- **G0：保留。** 该 migration 修复前一阶段 registration-only roles 虽获 `runtime.schemaversion` SELECT grant、却缺少相应 RLS policy 的启动可见性缺口；它是身份 API、通知 Worker、bootstrap 与后续 Purchase 边界的迁移前置环节，不能删除或与前一 migration 压缩混写。
- [FACT][E-AU-593-001] 仅允许 `zhudatuan_registration` 上的 `shopmigration`（或 superuser）执行，并要求 `20260828180000` 的精确 checksum 且拒绝未来 head，事务 advisory lock 防止并发 replay。
- [FACT][E-AU-593-002] contract guard 只接受两种已知 generated API/event/permission/error checksum，将旧值明确更新为现行值；未知第三 checksum 直接失败，不会静默覆盖漂移状态。
- [FACT][E-AU-593-003] 为 `zhudatuanidentityapi`、`zhudatuanidentityjob` 和 `zhudatuanbootstrap` 重建 schema version RLS policy，仅暴露各自启动/bootstrapping 必需的 marker；最终断言同时检查无写权限、RLS 已启用、三 policy 存在、contract checksum 与自身 schema marker 精确匹配。
- [FACT][E-AU-593-004] `IdentityRegistrationApiRuntime` 和 `IdentityNotificationJobsRuntime` 的真实兼容性查询均依赖 `RUNTIME_CONTRACT_CHECKSUM` 与 schema ledger；该迁移因此承担真实启动链职责，不是孤立的历史说明文件。

## 未验证项

- 未验证真实生产/登记数据库是否已应用本 repair、当前 ledger checksum、RLS policy owner 或身份 API/Worker 的实际启动状态。
- 未执行 migration replay、未知 checksum 拒绝路径或三角色 RLS allow/deny 测试；实际历史停机窗口未知。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；未来若变更 generated contract checksum，须在独立迁移中同时验证 Identity API、job runner 与 bootstrap 的 schema ledger visibility。
