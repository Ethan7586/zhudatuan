# AU-034｜Tmallmarket Provider 深审

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`01_core_hexin/extensions/providers/tmallmarket`
- 覆盖：9/9文件、79/79行深入审阅。
- 运行链：Commerce provider 注册 → `RuntimeExtensionLoader`远程分支 → `TmallmarketProvider` → `createTmallClient`（`@shop/vendortmall`）→ `createPorts` 与标准 port mapping → `tmall` vendor 操作。

## 结论

- F-0130/P2：`manifest`声明`Return`能力，但operations仅包含`catalog/price/stock/order/cancel/tracking/refund/statement`；能力与port未闭合，未来如引入退货固定caller会出现声明/执行不一致。
- F-0131/P3：测试仅核验`required ID`与`manifest`签名；未实例化factory，不覆盖`cancel/refund`实际请求、`Return`口径、`health`与`webhook`承接。
- DC-0041/G1：`mapTmallmarketError`目前为全仓静态零caller；`Webhook`与`Mapper`为公共导出，仓外兼容/观察路径未排除，暂不判删。

## 保留设计

- `healthOperation`与`secretRefs`与`@shop/vendortmall`鉴权链路一致；`Manifest`与`operations`按标准channel capability/port命名建立主要履约链。
- `eventSubscriptions`显式包含`ProviderWebhookReceived`，说明该provider保留回调接入责任。

## 验证状态

- 正式`test/typecheck`与`npm run typecheck`在审计工作树缺`vitest/tsc`时退出 127；未安装依赖。
- 未访问线上`extensions.enabled_installations()`；未调用真实vendor端点。
- 未修改实现，也未推送、合并、修复、部署。
