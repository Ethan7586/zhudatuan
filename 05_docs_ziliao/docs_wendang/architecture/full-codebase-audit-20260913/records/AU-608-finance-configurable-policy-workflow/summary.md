# AU-608｜财务可配置政策工作流

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260830100000_finance_configurable_policy_workflow.sql`（811 行）。
- 审阅方式：逐段人工审阅 schema、legacy policy sealing、policy rule/conflict validators、preview/action-proof/manage state machine、expected-version rewrite、RLS/ACL、runtime operation/capability 投影与 assertions；交叉检查 `FinancePolicyWorkflow`、`OperationController` 的新 policy scope binding、`AccessPipeline`、action proof 记录和定向路由测试。未连接数据库或执行迁移/测试。

## 审计结论

- **G0：保留。** 这是 `finance.policy` 从可变当前指针迁移到 preview + append-only revision + four-eyes approval 的唯一基础工作流，不是孤立历史 SQL。
- [FACT][E-AU-608-001] `policypreview` 限定五分钟、唯一 preview hash/范围内 idempotency、只允许一次 consumption；`policyrevision` 的状态/actor/timestamp check 与 immutable trigger 将 draft/submit/approve/reject 作为不可改写的 revision 事实。
- [FACT][E-AU-608-002] preview 与 manage 均绑定 API workload、actor、scope、scope RLS、expected version、idempotency 与 deterministic content hash；manage 消费同 transaction 的 Level-3 action proof marker，并以 row lock、scope/kind advisory lock、preview hash/source hash 和 single-use consumption 处理竞争与重放。
- [FACT][E-AU-608-003] `FinancePolicyWorkflow` 是真实 API consumer：preview 先验证可配置字段、mall delegation 与 effective range；manage 调用受控 DB function。`OperationController` 对新 policy 不传未存在的 path resource，而以 `x-scope-hint` 选择 scope；AU-607 resolver 与 `AccessPipeline.checkScope` 仍完成 membership grant 复核。
- [FACT][E-AU-608-004] raw table write 被收回，shopapp 仅能执行 preview/manage 且只读 revision；approve 才更新 approved pointer，入库后再消费 preview。现有 policy 被封存为首个 immutable revision，不伪造历史中间状态。

## 新增问题

- F-0263（P2）：migration 缺少数据库身份、精确 predecessor checksum 和 future-head guard；详见 `04-findings.md`。该问题不证明已在生产发生，未发现 P0。

## 未验证项

- 未在隔离 PostgreSQL 回放 legacy policy、preview timeout、双人审批、动作证明重放、RLS/ACL 拒绝或并发 approve；前端/API 实际传入 proof 与数据库 session context 的线上一致性未验证。

## 结论等级

- 新增问题：P2 1 项（F-0263）。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；修复必须从最新主线新建仅迁移 guard 的独立批次，不能改写本历史迁移。
