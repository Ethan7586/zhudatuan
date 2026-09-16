# AU-695｜SFL 管理员分段 Scope 基础

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260912150000_create_sfl_administrator_segment_scope.sql`（基础数据模型与演进关系）。
- 审阅方式：结构性审阅。确认 administrator identity、active/revoked version、segment closure visibility、idempotency change/note/outbox 和应用操作入口；发现核心 write function 已被后续前向 migration 替换，未将本历史 function 当作当前生效实现下最终结论。

## 审计结论

- **G0：保留。** migration 首次建立 administrator identity、segment scope/version、change receipt、member note、scope-visible node read 与审计 outbox；`AdministratorSegmentOperations` 是实际 command caller。这些 relation仍被后续当前 implementation 保留/演进，不能删除。
- [FACT][E-AU-695-001] 基础模型以 active unique index 与 version/access_version 将 scope replacement/revoke 同 membership access version 绑定；node closure + signed level（L0–L11）决定 first/second/both segment 的可见性。
- [FACT][E-AU-695-002] `access.change_administrator_segment_scope` 在本 migration 定义，但 `20260912230000_separate_permission_write_targets.sql` 对同签名函数执行 `create or replace`，并以函数定义摘要建立 repair assertion。因此本批原始 function 不是固定基线的唯一生效 write boundary。

## 未验证项

- 当前生效 function、grant/revoke target split、真实 role session/trigger/RLS matrix与完整 DB interruption rollback留给 AU-696（后续 migration）深入审阅。
- 未连接 production PostgreSQL，未验证已有 administrator identity/scope 数据、role ownership或 outbox delivery。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（administrator segment identity/scope foundation）；不新增 G1/G2/G3/GX。
- 二次复核：否；任何后续删除或权限修正必须连同 AU-696 的最终 write boundary重新复核。
