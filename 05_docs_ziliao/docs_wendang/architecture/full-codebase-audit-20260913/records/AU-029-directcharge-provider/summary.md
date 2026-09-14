# AU-029｜Directcharge Provider 深审

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`01_core_hexin/extensions/providers/directcharge`
- 覆盖：9/9文件、79/79行深入审阅。
- 运行链：Channel/Fulfillment jobs → Registry → DirectchargeProvider → Wanlian VendorClient → 配置endpoint。

## 结论

- F-0119/P1候选：factory发布order/tracking，但manifest没有Fulfillment固定请求的Order/Logistics，只有Issue/DirectCharge/Query；核心履约任务会在调用万联前被Registry拒绝。
- F-0120/P2：Issue、DirectCharge、Query、Verify等capability与order/tracking/verification ports没有权威配对；Registry分别检查字符串和port，多个能力可任意解锁同一现有port。
- F-0121/P3：唯一测试只检查required ID和签名，不实例化Provider或执行直充、查询、退款、验券、Webhook及响应映射。
- DC-0037/G1：`mapDirectchargeError`固定仓库零caller但仍公共导出；DirectchargeWebhook继续由DC-0026覆盖。

## 保留设计

- DirectchargeMapper要求Catalog记录含externalId/version/payload；万联RSA认证和Vendor Core运行约束集中复用。
- order/refund/verification明确标记非幂等，不由共享Client自动重试。
- manifest/factory/Commerce静态工厂入口存在，不能按零业务caller判垃圾。

## 验证状态

- 正式test/typecheck因缺vitest/tsc在源码加载前退出127；未安装依赖、未build。
- 未连接万联、数据库或线上installation；F-0119尚未完成第二轮独立复核，无P0证据。
- 没有修复、删除、推送、合并或部署。
