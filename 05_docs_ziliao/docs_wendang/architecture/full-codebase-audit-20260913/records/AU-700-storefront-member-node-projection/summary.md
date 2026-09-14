# AU-700｜Storefront Member-Node Projection

- 审阅范围：`20260912182000_create_storefront_member_node_projection.sql` 与 `20260912183000_fix_storefront_member_node_projection.sql`，以及仓内 Identity/Storefront/Member 调用检索。
- 审阅方式：深入审阅 security-definer projection、membership/registration/node/relation join、v1→v2 行为修复、ACL assertion及静态运行消费者。

## 审计结论

- **G0：保留。** v2 function 是 Identity API 唯一被授权的 member-node projection boundary，不向 Identity API暴露三个底层组织 relation 的 table privilege。
- [FACT][E-AU-700-001] v1只在存在 member registration 时返回行；v2改为 storefront membership 总是返回一行，并在没有 registration 时返回 `node_id/parent_node_id = null`、`signed_level=L6`、`node_profile=consumer`，有多次 registration 时确定性取最新记录。
- [FACT][E-AU-700-002] v2保留 owner=`zhudatuanroot`、security definer、public revoke与 Identity API execute-only assertion。它不写 membership、registration或 node data。
- **G1：疑似闲置，证据不足。** 固定基线的非测试 source、apps、packages、tools和质量脚本未发现 `identity.resolve_storefront_member_node` 静态调用。该 function仍是 migration 所登记的 Identity API public database boundary，仓外 Identity service/direct DB consumer、发布制品和未来 route 未排除，禁止删除。

## 未验证项

- 未连接生产数据库或 Identity API，不能确认该 function 是否由仓外 service/SQL调用，以及 default L6 是否符合线上业务期望。
- 未运行全量 database contracts；迁移内 assertion证明 ACL/object shape，但不替代真实外部 API consumer验证。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（Storefront projection boundary）；G1 1 项（当前无仓内 caller的 function consumer status）；不新增 G2/G3/GX。
- 二次复核：G1升级前必须检查 production function dependency/privilege、Identity API release artifact和仓外 consumers。
