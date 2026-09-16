# AU-021｜Provider Core 渠道供应商适配内核

## 1. 边界与覆盖

- 固定源码基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`；开工检查点 CP-20 `b8b49298`。
- 覆盖 `01_core_hexin/extensions/providers/core` 11/11 文件、354/354 行，全部深入审阅；沿生产链复核11个Provider factory、RuntimeExtensionLoader、ExtensionRegistry、ApplyWebhook、ChannelWebhookJob和`channel.accept_webhook`迁移。
- 审阅范围包括Provider生命周期、installation契约、通用port工厂、映射器、错误映射、limits、Webhook抽象、测试与公共barrel。
- 没有连接provider、数据库或secret store，没有安装依赖、构建、修复、删除、推送、合并、部署或改变线上资源。

## 2. 真实架构

[FACT][E-AU-021-002/003] `@shop/providercore`不是进程或数据所有者。RuntimeExtensionLoader从数据库安装记录和secret构造11类Provider factory，ExtensionRegistry验签Manifest、启动、健康检查并按`provider + scope`冻结提供port；Catalog/Price/Stock/Order/Cancel/Tracking/Refund/Statement/Verification通过VendorClient调用外部供应商。

[FACT][E-AU-021-004] 通用Webhook生产路径不是`src/Webhook.ts`：`createPorts`生成`ProviderWebhookVerifier`，公开Channel route取连接、服务端接收时间和`x-provider-event-id`，验签/normalize后加密原文，并以数据库`unique(connection_id, external_id)`去重，再由channelwebhook job更新provider operation和写outbox。

## 3. 主要结论

- [P1-CANDIDATE][E-AU-021-005/006] 通用HMAC只覆盖`timestamp.body`，生产去重身份`x-provider-event-id`不在签名材料内，甚至不在Verifier request类型中。有效请求在5分钟窗口内可原样重放、只更换event ID并再次通过验签和数据库唯一键，产生新的inbox/job/outbox，形成F-0094/RV-0013。下游对同一external reference做状态覆盖但每个inbox仍产生独立事件；影响规模和真实供应商协议未验证，故不是P0。
- [P3][E-AU-021-007] 唯一测试验证的是另一套无生产caller的`Webhook`类，其request把externalId传给verifier；没有测试`createPorts`生产HMAC、event-id改写或DB去重边界。因此测试可绿而F-0094成立，形成F-0095。
- [G1][E-AU-021-007/008] `src/Webhook.ts`只被单测和多个Provider包改名再导出，生产factory/loader/route不实例化；因公共导出、包间转发和可能仓外consumer尚未排除，列DC-0026/G1，不能删除。
- [FACT] installation Manifest字段、数组和limits与factory definition闭合比较；Registry同时检查声明capability与实际port；读/带业务幂等键的写调用由VendorClient控制重试。未发现P0。

本AU新增P1候选1项、P3 1项；累计P0 0、P1候选11、P2 46、P3 37、NIT 1。新增G1 1项；累计G0 2、G1 22、G2 2、G3 0、GX 2。

## 4. 验证与未知

- 正式 `npm test -- --reporter=dot` 与 `npm run typecheck` 均因固定工作树缺 `vitest`/`tsc`，在源码加载前以127退出；未安装依赖。
- 合成HMAC反事实显示event:A与event:B在timestamp/body相同时产生完全相同签名；源码和DB进一步证明event ID不在验签材料而是唯一去重键。
- [UNKNOWN] 线上启用的provider、各真实供应商Webhook签名规范、网关是否另行固定event ID、现有重复inbox数量和下游消费者幂等性；本AU未访问线上。
