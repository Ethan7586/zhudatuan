# AU-685｜SFL Node Sovereignty Foundation

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260911200000_create_sfl_node_sovereignty.sql`（137 行）。
- 审阅方式：深入审阅。核对 node/relation schema、history trigger、Realm bootstrap、后续 multi-Realm resolver、hosted Mall opening和已有 SQL contracts；未重复审阅各类具体 node opening workflow。

## 审计结论

- **G0：保留。** 该 migration 是 SFL node identity/lineage/host sovereignty 的基础数据模型；后续 session、member registration、administrator segment scope 和 sovereign-upgrade contract 均直接依赖它。
- [FACT][E-AU-685-001] `organization.node` 将 Realm 一对一绑定至 node，并限制 sovereign node 必为 operating Mall、consumer node 不得直接绑定 Mall；`noderelation` 保存 line、signed level、original parent、current parent及 host sovereign node 的版本化历史。
- [FACT][E-AU-685-002] relation trigger 只允许 supersede 已有历史行，下一 version 必须与前一行连续、以其 supersede time 作为 effective time、且不能改写 original parent；partial unique index 保证每 node/line 只有一个 current relation。
- [FACT][E-AU-685-003] bootstrap 从 L0/L1 Realm 构造两条 sovereign node/initial relation；后续 multi-Realm membership resolver 与 registration code读取 current node/relation，已存在 `sfl_administrator_segment_scope_contract.sql`、`sfl_member_registration_progression_contract.sql` 和 `sfl_sovereign_upgrade_contract.sql` 对其后续语义做执行型覆盖。
- 未发现该 foundation migration 自身的独立缺陷或垃圾代码候选。

## 未验证项

- 未在隔离数据库执行 migration/contract SQL，未验证 concurrency 下 relation supersede/insert 的事务交错。
- 未读取生产 node/relation history，无法断言 L0/L1 bootstrap或后续 migration ledger 已完成。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（SFL node sovereignty schema/history guard）；不新增 G1/G2/G3/GX。
- 二次复核：否。
