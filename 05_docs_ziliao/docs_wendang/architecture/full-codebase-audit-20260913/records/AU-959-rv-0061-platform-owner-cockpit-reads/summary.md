# RV0061｜GX-0039 Platform Owner Cockpit catalog/inventory read

- 复核对象：`20260821076000_grant_platform_cockpit_reads.sql`、Console prefetch/产品入口、catalog 与 inventory read handlers。
- 直接证据：迁移仅替换 `catalog.listing.read`、`inventory.read` 的 deny 为 allow，并断言 Owner membership 可执行 `catalog.listings.read` 与 `inventory.availability.read`；Console 在 session capability 含 `catalog.listings.read` 时才预取商品列表。
- 运行边界：catalog read 用 AccessPipeline 解析后的 scope 查询 listing 或 supplier source；inventory read 必须存在 mall context 并以该 mall id 查询。`catalog.listings.publish/unpublish` 等发布写操作与任何库存写入均为独立 operation/permission，未包含在迁移内。
- 结论：这是 Cockpit 商品和可用库存的精确只读通路，不是 UI-only 或写权限扩张；GX-0039 维持。未执行迁移、测试或线上操作；未发现 P0/P1。
