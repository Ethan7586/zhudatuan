# AU-668｜Generalize Storefront Roles

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260908013000_generalize_storefront_roles.sql`（63 行）。
- 审阅方式：逐段人工审阅 registration invite role predicate、function privilege 和 assertion；反向检查 access.role uniqueness、MemberPort 的 invite/storefront registration 查询及后续 Mall role provisioning。未执行数据库函数。

## 审计结论

- **G0：保留。** migration 将 Storefront invite 的许可从固定 role id 改为 Mall scope 内活跃的 `商城会员` role name，支持每 Mall 的规范 role id，同时没有扩张 operator invite 的白名单。
- [FACT][E-AU-668-001] `access.role` 对 `(scope_id,name)` 唯一；Storefront 分支仍要求 active role、精确 scope 与 `商城会员` 名称，不能因另一 Mall 同名 role 取得许可。
- [FACT][E-AU-668-002] `create or replace` 保留 AU-653 已收窄的 execute grants；本 migration assertion 再次验证 `shopapp`/Identity API 可执行、public 不可执行。search path 固定，role predicate 只读 access role/permission data。
- [FACT][E-AU-668-003] MemberPort 的 Storefront registration、invite validation 与 registration lookup 都已使用同一 role name/scope 语义；后续 Mall provisioning 正是按该 name 创建 Mall-bound role，运行消费与数据库 predicate 一致。

## 未验证项

- 未在隔离数据库测试禁用 role、错误 scope、同名非 Storefront role 或带 permission 的 pending operator role 的全部拒绝矩阵。
- 未验证生产中是否存在历史 Mall role name/状态异常；迁移仅替换函数定义，不回填 role 数据。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（Storefront invite role projection generalization）；不新增 G1/G2/G3/GX。
- 二次复核：否。
