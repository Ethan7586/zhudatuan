# AU-030｜Jdfresh Provider 深审

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`01_core_hexin/extensions/providers/jdfresh`
- 覆盖：9/9文件、79/79行深入审阅。
- 运行链：Channel/Fulfillment jobs → Registry → JdfreshProvider → JD VendorClient。

## 结论

- F-0122/P1候选：factory发布stock/tracking，manifest却用GeoStock/Delivery；Channel固定请求Inventory，Fulfillment固定请求Logistics。库存同步不可达，订单成功后的物流查询也不可达。
- F-0123/P2：TimeSlot capability没有对应port，GeoStock/Delivery与stock/tracking没有权威映射；Registry允许任意已声明能力配任意现有port。
- F-0124/P3：唯一测试只核required ID和签名，不执行factory、八个ports、JD响应或完整履约链。
- DC-0038/G1：`mapJdfreshError`固定仓库零caller但公共导出；JdfreshWebhook继续由DC-0026覆盖。

## 验证状态

- test/typecheck因缺vitest/tsc退出127；未安装依赖、未build、未访问JD/数据库/线上。
- F-0122待RV-0023独立复核；无P0证据。没有修复、删除、推送、合并或部署。
