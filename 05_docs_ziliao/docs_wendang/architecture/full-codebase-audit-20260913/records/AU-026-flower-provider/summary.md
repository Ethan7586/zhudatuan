# AU-026｜Flower Provider 深审

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`01_core_hexin/extensions/providers/flower`
- 覆盖：10/10文件、548/548行深入审阅。
- 运行链：Channel Catalog/Price/Inventory jobs → Registry → FlowerProvider → FlowerReadClient → CakeuncleClient → 分类/商品API。

## 结论

- F-0108/P2：请求固定每页200，但分页校验接受非末页1–199条，随后按200偏移推进，可能静默漏商品。
- F-0109/P2：每个非空Price或Stock批次都重新遍历分类与最多10,000商品页；Channel每500 key分批且两类任务分开，调用量重复放大。
- F-0110/P2：Flower把非零供应商市场价直接发布为compareMinor，即使低于售价；CatalogProductImport明确拒绝该组合，可能让对应目录导入失败或停留旧值。
- F-0111/P3：455行FlowerClient与Mapper没有行为测试，唯一13行测试只检查required ID和manifest签名。
- DC-0033/G1：`mapFlowerError`在固定仓库零caller但仍为公共导出；FlowerWebhook继续由DC-0026覆盖。

## 保留设计

- manifest、factory和endpoint配置只发布Catalog/Price/Inventory，并锁定分类与商品endpoint及唯一root category。
- Mapper严格检查分类层级、重复spec、金额精度、库存哨兵和响应成功码，并生成稳定版本hash。
- 空key Price/Stock会短路，不访问供应商。

## 验证状态

- 正式test/typecheck因缺vitest/tsc在源码加载前退出127；未安装依赖、未build。
- 未连接Flower供应商、数据库或线上installation；无P0证据。
- 没有修复、删除、推送、合并或部署。
