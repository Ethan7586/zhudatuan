# AU-707｜HBBTZN Storefront L6 回填

- 审阅范围：`20260913020500_backfill_hbbtzn_storefront_member_l6.sql`、其 hosted member registration函数、HBBTZN node/deployment references与 database-contract registration。
- 审阅方式：深入审阅固定 Mall 的目标选择、业务身份来源、idempotency、注册函数写入、事务失败语义和最终断言；部署文件仅确认其运行/节点关系。

## 审计结论

- **G0：保留。** 此历史迁移不是垃圾文件：它把 HBBTZN Mall 尚无 node registration的 Storefront membership 映射为 L6 consumer node/Realm，并使用按 membership确定的 registration/idempotency key；最终断言要求所有该 Mall Storefront membership具备对应 host、L6 relation及 active consumer node。
- [FACT][E-AU-707-001] `register_hosted_member_node` 以事务创建 consumer Realm/node/relation和member registration，registration idempotency与 business identity冲突均被锁/拒绝；本迁移以 direct origin固定挂到 `node:hbbtzn:l1`。
- **F-0288：P2。** 回填目标没有 `membership.status='active'` 条件，而 registration function也不验证 target membership状态；disabled/retired Storefront membership若无 registration也会得到 active consumer Realm/node。并且任一目标没有 active password credential会抛异常，令整个 migration transaction回滚，不会生成可逐项恢复的缺失成员清单。

## 未验证项

- 未读取固定生产 HBBTZN Mall membership/credential/registration数据、实际 migration ledger或执行日志；未断言迁移已失败或创建过无效节点。
- 没有该文件专用 PostgreSQL fixture；未运行全量 database runner，遵守定向验证纪律。

## 结论等级

- 新增问题：F-0288（P2，高置信度，需要独立复核）。无 P0。
- 垃圾代码：G0 1 项；不新增 G1/G2/G3/GX。
- 二次复核：是；应在隔离 PostgreSQL构造 active、inactive、revoked和无password/仅federated Storefront memberships，验证目标集合、回滚/继续策略、Realm/node orphan防护和执行回执。
