# AU-714｜Identity Catalog Command ACL

- 审阅范围：`20260907010000_enable_identity_catalog_commands.sql`、Identity operation catalog、Catalog operator API entry、Identity runtime source与数据库 contract references。
- 审阅方式：深入审阅 grant/RLS relation、实际 route/module ownership与非测试 caller；重复 contract/object inventory作结构性审阅。

## 审计结论

- **G1：疑似闲置，证据不足。** 固定基线的 Identity API operation catalog仅包含身份/邀请/会话等 operations，未发现仓内 Identity module、route、worker或非测试 SQL读取/写入本迁移授予的 `catalog.importjob/importrow/importerror/listing`。Catalog import/listing routes已由独立 Catalog operator API承载。
- [FACT][E-AU-714-001] 历史 migration仍向 `zhudatuanidentityapi`授予 Catalog table privileges，并以 `access.scope_allowed` 保护 importjob/importrow/listing的 RLS write/read分支；它不是空文件或构建产物。
- 不新增代码删除结论：仓外 Identity API、direct database caller、历史 migration replay、RBAC/release contract与生产 privilege state均未排除。

## 未验证项

- 未读取生产 `pg_policies`/table RLS/role inheritance、Identity API SQL trace或仓外 callers；未断言该 ACL实际无用或导致暴露。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G1 1 项；不新增 G0/G2/G3/GX。
- 二次复核：G1不强制；任何收窄前必须以生产/isolated role核对 actual privileges、RLS、connection pool、external Catalog command callers和历史 compatibility。
