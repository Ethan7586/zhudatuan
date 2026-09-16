# AU-669｜Published Listing Storefront Pool Binding

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260909010000_bind_published_listings_to_storefront_pool.sql`（73 行）。
- 审阅方式：逐段人工审阅 published listing 回填、pool item projection 和 assertion；反向检查当前 CatalogPublicationJob、Web catalog/checkout reader 与 batch publication test。未执行数据库回填。

## 审计结论

- **G0：保留。** 这是早期独立 catalog import 产生的已发布但未投影 listing 的数据修复迁移；它只绑定无 pool 的 published listing，不修改已有 pool binding 或 draft listing。
- [FACT][E-AU-669-001] 回填选择 Mall 最新 active released Storefront binding 的 pool，先 upsert `catalog.poolitem`，再在成功存在 projection 时写 listing pool/version；有效上架路径要求同一 pool binding 语义。
- [FACT][E-AU-669-002] 当前 `CatalogPublicationJob.publishOne()` 使用与迁移相同的 active application/release 排序和 pool selection，且在 listing/pool item 同一 CTE 处理；Web catalog、报价和 checkout 读取均以 published listing 的 pool 过滤。
- [FACT][E-AU-669-003] migration assertion 只要求“存在 active Storefront binding 的 published listing”不再缺 pool；无 active binding 的旧 listing 不会被虚构绑定，仍由后续出版流程返回 `STOREFRONT_POOL_MISSING`。

## 未验证项

- 未运行历史 import 数据回填，无法确认基线中有多少受影响 listing 或每个 Mall 是否存在多个同时 active Storefront binding。
- 现有 TypeScript test 仅验证 publication query 形状，未对该历史回填 migration 运行 fixture contract。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（已发布 listing 的历史 pool projection/backfill）；不新增 G1/G2/G3/GX。
- 二次复核：否。
