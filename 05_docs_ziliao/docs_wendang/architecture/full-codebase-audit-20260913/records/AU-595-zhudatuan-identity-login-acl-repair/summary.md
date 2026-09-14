# AU-595｜筑大团身份登录 ACL 修复

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260829054500_zhudatuan_identity_login_acl_repair.sql`（79 行）。
- 审阅方式：逐行人工审阅 boundary/ledger guard、login attempt 最小权限、RLS 与断言；交叉检查 `CredentialOperations` 实际成功登录清理调用与 deployment contract 检查。未连接数据库或运行登录。

## 审计结论

- **G0：保留。** 此 migration 修复 registration API role 缺少 `identity.loginattempt` DELETE 的权限缺口；成功密码登录需要删除 subject/account/network/device 的失败记录，缺失时会让已验证登录事务 fail-closed 为 `INTERNAL_ERROR`。这是实际认证行为的迁移修复，不能删除。
- [FACT][E-AU-595-001] `CredentialOperations` 在凭据验证成功后执行 `delete from identity.loginattempt where realm_id=$1 and subject_hash::text=any($2::text[])`；本 migration 仅向 `zhudatuanidentityapi` 补授 DELETE，未给予 TRUNCATE/REFERENCES/TRIGGER。
- [FACT][E-AU-595-002] 执行要求独立 registration database、AU-594 精确 predecessor marker 且拒绝 future head；最终断言确认 login attempt 仍启用 RLS、identity API 的 ALL policy 仍在、登录所需所有表/模式权限齐全以及自身 marker 精确存在。
- [FACT][E-AU-595-003] 该文件记录的是已设计的历史修复；本审计未运行登录，无法证明真实数据库在修复前后是否发生过该错误或当前角色权限是否已生效。

## 未验证项

- 未执行成功/失败登录、计数清理、并发登录、RLS deny 或 migration replay；线上失败率、影响用户数与实例状态未知。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；若身份登录专项重新改动，须在隔离库覆盖成功清除、失败计数、跨 realm/subject 拒绝与事务回滚。
