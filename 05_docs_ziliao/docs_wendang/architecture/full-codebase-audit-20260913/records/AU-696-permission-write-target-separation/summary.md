# AU-696｜管理员权限写入目标分离

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260912230000_separate_permission_write_targets.sql`（208 行），以及 `AdministratorSegmentOperations`、context resolver、PostgreSQL 17 acceptance fixture。
- 审阅方式：深入审阅。核对 operation → resolver → security-definer command、administrator identity/target membership/Realm/node/organization/role boundary、idempotency/concurrency/outbox，以及后续 migration 对原始 AU-695 function 的替换语义。

## 审计结论

- **G0：保留。** 当前 function 有意禁止在 scope-manage command 内创建或更新 administrator identity；只接受预存在、active、operator client、Realm/organization 对齐且 identity binding 完整的 target，避免权限写入同时改变身份归属。
- [FACT][E-AU-696-001] operation 先由 `PgAdministratorContextResolver` 将 console actor、account/principal/Realm/access version 与 DB active administrator context精确比对；SQL 再检查 `access.scope.manage`、target active operator、admin realmtarget/organization、actor segment visibility、role scope/`member.read`、optimistic version、idempotency 和 per-target advisory lock。
- [FACT][E-AU-696-002] 初步怀疑的 target `host_node_id` join 并非多行不确定：`organization.node.realm_id` 是唯一列；operator identity 初始化也从相同 Realm→node 关系写入。因此不构成 finding。
- [FACT][E-AU-696-003] `npm run check:sfl-administrator-segment-scope` 于 2026-09-15 通过。正式 PostgreSQL 17 fixture覆盖 shopapp execution、pre-existing target、Realm/governance alignment、no identity mutation、L0–L5/L6–L11/both visibility、transaction interruption rollback、同 key replay与不同 key concurrency。

## 未验证项

- 未读取生产 role ownership、现存 administrator scope数据或 outbox consumer delivery；不据此推断线上状态。
- fixture 不是完整基线 migration replay，且未覆盖 `shopconsole`/Identity API execute matrix、所有 role inheritance/BYPASSRLS 属性与生产连接池 session配置。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（administrator scope write-target separation）；不新增 G1/G2/G3/GX。
- 二次复核：否；若未来扩展 function caller/role或恢复 identity mutation，必须以当前 PG17 allow/deny/concurrency contract复核。
