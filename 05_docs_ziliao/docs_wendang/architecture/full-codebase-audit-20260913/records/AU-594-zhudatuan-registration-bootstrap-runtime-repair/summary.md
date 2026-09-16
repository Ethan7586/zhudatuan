# AU-594｜筑大团注册 Bootstrap 运行时修复

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260829040000_zhudatuan_registration_bootstrap_runtime_repair.sql`（106 行）。
- 审阅方式：逐行人工审阅 database/ledger guard、最小 SELECT grant、RLS policy 与最终断言；交叉检查 `BootstrapRegistration`、`BootstrapOwner`、`Migrate` 和 registration deployment 检查。未连接数据库或运行 bootstrap。

## 审计结论

- **G0：保留。** 此 migration 是 AU-590 owner/registration bootstrap 可执行性的后续权限修复：专用 bootstrap role 仅补足预检所需读取，所有身份与访问写入仍在已有 security-definer function 后，不能删除。
- [FACT][E-AU-594-001] 执行被限制为独立 registration database 的 `shopmigration`（或 superuser），并要求 AU-593 的精确 predecessor marker 且拒绝中间 future head。
- [FACT][E-AU-594-002] 仅授予 `identity.principal`、`access.membership`、`access.membershiprole` 的 SELECT，并用 RLS 限定 fixed owner、历史 demo membership、三项特定 role 和注册 invitation；assert 同时拒绝任何 INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER 扩权。
- [FACT][E-AU-594-003] `BootstrapRegistration`、`BootstrapOwner` 与 `Migrate` 是仓内实际 preflight/call 入口，registration deployment 检查把此 repair 作为发布数据库契约的一部分。

## 未验证项

- 未验证真实 bootstrap role、RLS policy、preflight 或 owner registration 是否已在独立数据库成功运行；未执行 replay、拒绝路径和恢复演练。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；若重新设计 registration bootstrap，应在隔离库验证 role 最小读取、RLS deny 和 security-definer 写入边界。
