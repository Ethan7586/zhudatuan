# AU-658｜Enable Identity Catalog Commands

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260907010000_enable_identity_catalog_commands.sql`（75 行）。
- 审阅方式：逐段人工审阅 Catalog ACL/RLS grants 和 runtime precondition；反向检索 Identity API modules、entrypoints、bootstrap、release config及后续 revoke/grant migrations。未执行数据库。

## 审计结论

- **G0：保留 migration 记录，关联 F-0273。** migration 仍是 schema history 的实际 ACL/RLS 写入，不能删除或改写；但其授予的 Identity API Catalog command 表权限在当前运行拓扑没有对应业务消费。
- [FACT][E-AU-658-001] 此文件为 `zhudatuanidentityapi` 授予 import job 的 SELECT/INSERT/UPDATE、import row/error 的 SELECT、listing 的 SELECT/UPDATE，且对写入/读取加 `access.scope_allowed(scope_id)` RLS policy。
- [FACT][E-AU-658-002] 对 Identity module、Identity entrypoint/bootstrap 的 catalog import/listing SQL、operation、route 与 adapter 检索，没有命中；Catalog Operator API 明确以 `hbbtzncatalogapi` runtime 运行，entrypoint test 亦声明其不承载 identity/member routes。
- **F-0273（P3，新增）**：仓内后续 migration 未找到该 Identity API Catalog ACL 的撤销或替代；该未消费权限扩大 Identity API compromise/SQL injection 的可写数据面。

## 未验证项

- 未在现网或隔离数据库读取实际 ACL/policy state，未核验是否有仓外 internal job 使用该 role。
- 未攻击或运行服务；结论仅基于运行单元、模块注册和 SQL consumer 证据。

## 结论等级

- 新增问题：P3 1 项（F-0273）。无 P0/P1/P2。
- 垃圾代码：G0 1 项（历史 ACL migration）；不新增 G1/G2/G3/GX。
- 二次复核：否；回收前应由 Identity/Catalog owner确认无仓外 consumer与生产 ACL 状态。
