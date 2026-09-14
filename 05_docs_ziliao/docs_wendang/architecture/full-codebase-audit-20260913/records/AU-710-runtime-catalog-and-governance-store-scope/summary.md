# AU-710｜运行 Catalog 对齐与治理 Store Scope

- 审阅范围：`20260905010000_publish_runtime_catalog_alignment.sql`、`20260905011000_expand_governance_store_scope.sql`、现行 capability/operation contract、RegistrationMigrationPlan与后续 canonical governance implementation。
- 审阅方式：深入审阅 operation→capability→permission→entitlement 关系、Store scope canonicalization及其后续替代；重复 ledger source-digest记录按结构性审阅。

## 审计结论

- **G0：保留。** 050100 将已注册的订单签收与支付意图读取操作补齐至 runtime/capability catalog；权限映射与现行 contract一致：member仅在自身资源边界内以 `order.read` 确认签收、以 `payment.create` 读取相关 payment intent。
- [FACT][E-AU-710-001] 订单签收 handler以 `member_id=access.scope.id` 锁定/更新 order，支付读取以当前 membership/Mall传入 repository；故 catalog permission不是单独的数据访问授权，而是 operation gate后叠加资源所有权检查。
- [FACT][E-AU-710-002] 050110 曾将 `partner.store`纳入 canonical governance scope；后续 20260902132000 以组织层级 canonicalization替换该 function。固定基线中的 Store Web operations仍用其专用业务 scope，不依赖已替换的治理 Store candidate。
- [FACT][E-AU-710-003] RegistrationMigrationPlan中的两份不同 digest是 registration-only ledger的 source SHA256；数据库 schema target则从 migration内的 `runtime.schemaversion` marker读取，二者用途不同且当前实现显式区分。

## 未验证项

- 未运行全量 database contracts或真实 member API；未读取生产 capability entitlement、Store/tenant hierarchy或 runtime operation catalog。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 组；不新增 G1/G2/G3/GX。
- 二次复核：不要求新增独立复核；任何恢复 Store governance scope或改变 permission mapping时，需验证 capability gate、member resource ownership、cross-store deny和历史 migration ledger语义。
