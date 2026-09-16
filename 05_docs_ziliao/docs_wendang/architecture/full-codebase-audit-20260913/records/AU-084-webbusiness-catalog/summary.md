# AU-084｜WebBusiness Catalog 读取与公开目录入口深审

`catalog.listings.read` 由 WebBusiness selected module 执行：supplier scope 读 source listing；其他 scope 按组织 closure 读 listing；storefront 自动限定 published/current-effective listing。查询使用 keyset cursor，console 可以获得 management summary 与 supply-network projection。

`PublicCatalogHttpHandler` 仅接管 `/api/v1/catalog/public/products` 的 GET；Origin 只在请求携带时校验，application slug 由 host mapping/default 配置锁定，跨 node 指定被拒绝。它调用 `catalog.public_storefront_catalog`，以 30 秒 public cache 返回数据，但输出固定 `purchasable=false`、`memberPricing=false`，并把购买原因保留为登录/库存/价格条件。

四个现有测试验证分页 SQL/summary、公开 host binding、canonical delegation 和购买锁定。未见 P0–P3 新问题；固定审计 worktree 未运行 Vitest。
