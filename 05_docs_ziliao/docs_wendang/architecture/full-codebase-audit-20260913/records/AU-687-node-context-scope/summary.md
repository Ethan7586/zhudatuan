# AU-687｜SFL Node Context and Indexed Scope

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260912010000_create_sfl_node_context_scope.sql`（211 行）。
- 审阅方式：深入审阅。核对 closure materialization/refresh、context and indexed scope functions、grants、TypeScript resolver及 PostgreSQL reparenting contract；未重复审阅 hosted node creation的输入校验。

## 审计结论

- **G0：保留。** node closure 把多层 node lineage 转为可索引 scope queries，是 session/member/provisioning 权限计算的真实数据依赖，不是可以按派生数据删除的缓存。
- [FACT][E-AU-687-001] migration 从 current relations 建立 closure；新 relation insert 后，仅 supersede affected node及其 current descendants 的旧 paths，再依据新的 current topology 重建，保留历史 effective/superseded time。
- [FACT][E-AU-687-002] context/self/ancestor/descendant/subtree functions全部只查询 current relation/closure，且仅授予 provisioning role；`PgAuthoritativeNodeContextResolver` 只接收服务端 target node id，`PgNodeScopeResolver` 通过固定 SQL function names 和 line-id consistency check读取 scope。
- [FACT][E-AU-687-003] `sfl_node_context_scope_contract.sql` 执行 L1–L11 hierarchy、indexed result、替代 node、relation supersede/reparent、closure history和 suspended node retention；覆盖真实 closure refresh path而非仅 SQL 文本。
- 未发现该模块的独立缺陷或垃圾代码候选。

## 未验证项

- 未并发执行 reparent/update + node provisioning，advisory lock以外的长链 closure refresh contention未在本审计中实测。
- 未读取生产 closure 数据，不能验证是否存在历史关系不连续或运行期 performance问题。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（node context/closure/indexed scope boundary）；不新增 G1/G2/G3/GX。
- 二次复核：否。
