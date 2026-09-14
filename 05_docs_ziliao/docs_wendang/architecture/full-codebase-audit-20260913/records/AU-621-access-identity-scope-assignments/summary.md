# AU-621｜Access Identity Scope Assignment

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260901100000_access_identity_scope_assignments.sql`（173 行）。
- 审阅方式：逐行人工审阅 schema/backfill、membership resolver 的 role/owner/successor/self 分支、scope intersection 与 assertion；交叉检查 scope normalization history。未连接数据库或执行迁移。

## 审计结论

- **G0：保留。** 本 migration 为成员角色分配记录 explicit assignment scope，并将其纳入 effective permission resolver；它是多层组织授权边界的一部分。
- [FACT][E-AU-621-001] 仅在 exact predecessor/no future head、目标 relation/function 存在且四列尚未出现时运行；除 Owner/self/pending 特例外，历史 assignment 从 role scope/organization closure 回填 scope kind/id/path/source。
- [FACT][E-AU-621-002] 新 resolver 对普通 role 同时要求 role 覆盖 membership organization、role 覆盖 target grant scope，以及 assigned scope 等于或覆盖 target scope；避免角色被下放后沿更宽 role scope 获得超出 assignment 的 grant。
- [FACT][E-AU-621-003] Owner/successor/self 分支保留 singleton、bootstrap、personal scope 与 transfer permission 的显式条件；deny overlay/temporal validity/access version仍参与最终 grants。assert 检查 backfill 完整性和 ledger。

## 未验证项

- 未在隔离数据库验证各组织层级、过期 assignment、Owner transfer/bootstrap 和 explicit deny 的组合；新列没有在本 migration 中声明非空/外键约束，后续写入者约束未验证。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；未来 scope assignment 写接口须用跨层级正反事实验证 resolver，而不只断言列已回填。
