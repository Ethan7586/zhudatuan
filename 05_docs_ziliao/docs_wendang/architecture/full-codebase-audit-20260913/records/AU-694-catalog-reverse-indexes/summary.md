# AU-694｜Catalog 反向查询索引

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260912140000_index_catalog_reverse_lookups.sql`（15 行）。
- 审阅方式：结构性审阅。核对 index key/partial predicate、真实 Catalog/Checkout/Referral/Fulfillment join 方向，以及后续 runtime reconciliation；不对同构调用点作重复深入阅读。

## 审计结论

- **G0：保留。** 三个索引分别服务 `sku(product_id,id)`、`listing(sku_id,scope_id)` 与非空 source listing `(sku_id,scope_id)` 的反向 lookup。真实生产 query 包含产品→SKU、SKU→scope listing 与 SKU→scope source listing；后续 `20260912180000_reconcile_identity_runtime_state.sql` 也将三者作为已验证 runtime objects 重建。
- [FACT][E-AU-694-001] `WebCatalogOperations` 的 SKU product count、`ReferralOperations` 的 scope+SKU listing join、`QuoteReader`/Fulfillment 的 catalog joins 与索引前缀一致；partial source-listing index 的 `sku_id is not null` 与其仅用于已映射 SKU lookup 的语义一致。
- 未发现写路径、权限、数据迁移或外部契约变化。本 unit 不新增 finding 或垃圾代码候选。

## 未验证项

- 未在生产或全量 fixture 执行 `EXPLAIN (ANALYZE, BUFFERS)`，不能断言实际选择率、索引命中率或写入成本；本结论仅证明其运行责任与查询形状。
- 相关 performance test 未重复启动：本 worktree 先前定向 Vitest 入口已因缺少 `vitest` executable 不能启动，按审计边界未安装依赖。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（三个 catalog reverse lookup indexes）；不新增 G1/G2/G3/GX。
- 二次复核：否；若拟删改索引，必须以真实 production-like `EXPLAIN` 和写入负载复核。
