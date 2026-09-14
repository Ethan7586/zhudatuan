# AU-081｜Pricing 运行入口、报价与策略链路深审

审阅范围为 Pricing 的 10 个源码/测试文件（171 行），并反向追踪 Commerce module registry、契约/SDK、Catalog 导入与投影、Checkout/Purchase quote、Runtime cleanup、`pricing` 表迁移和 QuoteReader。

## 真实运行关系

`BUSINESS_MODULES` 注册 `PricingModule`，由 `pricingOperations` 提供三个 HTTP contract：member `pricing.offers.read` 及 operator `pricing.rules.create/publish`。Catalog 包导入与 provider 投影通过 `pricingPort.upsertCatalogPackageOffer` 写入 deterministic pricebook/price；Checkout 与 Purchase 通过 `saveQuote` 固化已签名报价；cleanup job 删除未被 checkout session 引用且过期超过七天的 quote。

报价读取会抓取已发布 pricing rule，但 AU-081 的逐行计算确认：这些 rule 只写入 evidence，不改变 `unitMinor`、subtotal、discount 或 payable。F-0159 以 P1 候选进入 AU-082 独立复核。

## 本批结论

- 未发现 P0；未改变生产、测试、迁移、配置或运行状态。
- `PricingPort` 仍有公共运行职责，不能仅因 `saveProviderPrice` 当前未见仓内调用认定为垃圾；分类 G0。
- 唯一模块测试只验证 manifest，不能证明 rule 影响报价、价格有效期/并列 pricebook 选择、quote 写入/清理或失败回滚。
- 固定审计 worktree 没有 `vitest` 可执行文件；未安装依赖，未运行测试。
