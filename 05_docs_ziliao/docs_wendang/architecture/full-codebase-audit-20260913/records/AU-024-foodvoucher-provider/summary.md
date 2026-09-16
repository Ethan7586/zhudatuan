# AU-024｜Foodvoucher Provider 深审

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`01_core_hexin/extensions/providers/foodvoucher`
- 覆盖：9/9文件、79/79行深入审阅。
- 运行链：Commerce RuntimeExtensionLoader → FoodvoucherProvider → CakeuncleClient + Provider Core通用ports → Catalog/Statement jobs或Channel Webhook。

## 结论

- F-0100/P1候选得到第二条调用链复核并收窄：Provider对象确有catalog/order/cancel/refund/statement/verification/webhook，但Registry还要求manifest capability。现有静态caller可到Catalog、Statement和Webhook；Fulfillment以`Order`请求，无法通过manifest的`Issue`能力。风险不是“全部写入已在运行”，而是能力词汇和真实ports不闭合。
- F-0103/P1候选：当前required/available provider删除了已存在过的Cakeuncle专用只读Catalog/Price mapper，改用期待`records`的通用Mapper；manifest也移除Price，却新增未经证明的写入/Webhook能力。健康检查只探测单独health endpoint，不能证明业务port可用。
- F-0104/P3：包内唯一测试只断言required ID和manifest签名；根provider contract使用fallback ports，只检查`has()`，不执行Foodvoucher操作、不核额外port/能力映射，形成假阳性。
- DC-0030/G1：`mapFoodvoucherError`固定仓库零caller但仍为公共导出。FoodvoucherWebhook已被DC-0026覆盖，不重复编号。

## 历史证据

- 祖先提交曾包含专用`code/msg/data` mapper、Catalog/Price ports、固定voucher endpoint和相应行为测试；冲突收口时选择了通用1行Mapper/通用ports。历史只用于解释来源，最终缺陷仍由当前运行代码与当前契约冲突证明。

## 验证状态

- 正式test/typecheck均因缺vitest/tsc在源码加载前退出127；未安装依赖、未build。
- 未连接数据库、Cakeuncle、secret store或线上installation；无P0证据。
- 没有修复、删除、推送、合并或部署。
