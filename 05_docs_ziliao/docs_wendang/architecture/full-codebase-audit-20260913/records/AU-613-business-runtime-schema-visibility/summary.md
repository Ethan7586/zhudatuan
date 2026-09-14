# AU-613｜Business Runtime Schema 可见性

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260830105000_business_runtime_schema_visibility.sql`（40 行）。
- 审阅方式：结构性审阅；与 AU-612 对比权限差异、逐行检查 head guard 和 grant/assert，交叉检查 WebBusiness/Purchase compatibility 对 `member.profile` 的 relation resolution。未连接数据库或执行迁移。

## 审计结论

- **G0：保留。** AU-612 已撤销业务 API 的 member schema usage；本 migration 仅恢复 schema object-name resolution，使 startup compatibility 能解析 `member.profile` 后确认它仍无表权限。
- [FACT][E-AU-613-001] 唯一新增 privilege 为 Web/Purchase 对 `member` schema 的 `USAGE`，assert 明确拒绝两角色的 `member.profile` SELECT/INSERT/UPDATE/DELETE；不改变 AU-612 的 authority-table isolation。
- [FACT][E-AU-613-002] WebBusiness runtime compatibility 将 `to_regclass('member.profile')` 作为关系存在性检查；schema usage 是该只读 metadata resolution 的直接依赖。
- [FACT][E-AU-613-003] 使用 AU-612 precise predecessor、无 future head 和 transaction advisory lock，属于受控 role-matrix 后续小修复。

## 未验证项

- 未以实际 Web/Purchase role 调用 compatibility query 或验证 profile data access 被拒绝。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；未来 schema visibility grant 必须伴随 table privilege deny 反事实检查。
