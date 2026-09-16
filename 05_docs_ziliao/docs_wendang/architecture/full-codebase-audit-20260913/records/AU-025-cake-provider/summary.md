# AU-025｜Cake Provider 深审

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`01_core_hexin/extensions/providers/cake`
- 覆盖：13/13文件、807/807行深入审阅。
- 运行链：Channel Catalog/Price/Inventory jobs → Registry → CakeProvider → CakeReadClient → CakeuncleClient → 分类/商品API。

## 结论

- F-0105/P2：请求固定每页200，但分页校验接受非末页的任意非零短页；随后直接递增页码，供应商短页可静默漏商品。
- F-0106/P2：每个Price或Stock批次都重新全量遍历分类和最多10,000页商品；Channel每500 key分批且Price/Stock分开执行，网络调用随批次数重复放大。
- F-0107/P3：现有测试不覆盖短页、跨批次放大、deadline中断、跨页重复或真实Channel job集成。
- DC-0031/GX：未导出且未接Order port的Cake OrderRequest保存唯一履约请求约束，禁止直接删除或启用。
- DC-0032/G1：mapCakeError零仓内caller但仍为公共导出；CakeWebhook已由DC-0026覆盖。

## 保留设计

- manifest只声明Catalog/Price/Inventory，factory只发布对应三port；endpoint和唯一root category在构造期闭合。
- Mapper严格校验分类树、重复spec、金额精度、库存哨兵和供应商字段，并生成稳定版本hash。
- 非幂等Order builder明确不导出、不注册，和当前发布边界一致。

## 验证状态

- 正式test/typecheck因缺vitest/tsc在源码加载前退出127；未安装依赖、未build。
- 未连接Cakeuncle、数据库或线上installation；无P0证据。
- 没有修复、删除、推送、合并或部署。
