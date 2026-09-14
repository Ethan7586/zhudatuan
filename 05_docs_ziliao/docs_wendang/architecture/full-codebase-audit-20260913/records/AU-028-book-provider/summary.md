# AU-028｜Book Provider 深审

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`01_core_hexin/extensions/providers/book`
- 覆盖：9/9文件、79/79行深入审阅。
- 运行链：Channel/Fulfillment jobs → Registry → BookProvider → Wenxuan VendorClient → 配置endpoint。

## 结论

- F-0116/P1候选：Book可通过`Order/order`提交订单，成功后固定排入tracking；tracking caller请求`Logistics/tracking`，Book manifest只有`Shipment`，会在外部查询前被Registry拒绝，订单难以进入已送达闭环。
- F-0117/P2：manifest同时声明Return和Refund，但factory只有一个映射到`book.return.submit`的refund port；Registry不约束capability-port配对，两个词都可解锁同一port，契约语义不唯一。
- F-0118/P3：唯一测试只检查required ID和签名，不实例化Provider或执行九个ports、Wenxuan响应映射、Webhook和履约链。
- DC-0036/G1：`mapBookError`固定仓库零caller但仍公共导出；BookWebhook继续由DC-0026覆盖。

## 保留设计

- BookMapper要求Catalog记录至少含externalId/version/payload；VendorClient统一承载deadline、限流、并发、断路和条件重试。
- 非幂等Order/Cancel/Refund在通用PortFactory中明确标记不可重试。
- manifest、factory和Commerce静态工厂入口闭合，Book是required provider。

## 验证状态

- 正式test/typecheck因缺vitest/tsc在源码加载前退出127；未安装依赖、未build。
- 未连接Wenxuan、数据库或线上installation；F-0116尚未完成第二轮独立复核，无P0证据。
- 没有修复、删除、推送、合并或部署。
