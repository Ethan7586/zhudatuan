# RV-0016｜Foodvoucher 能力契约独立复核

- 复核日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应首审：F-0100
- 结论：**确认 P1；未发现 P0。**
- 方法：从运行时加载与注册入口重新追踪，不复述首审；未访问线上安装、供应商或回调。

## 独立调用链

`extension.enabled_installations()` → `RuntimeExtensionLoader.load()` → `providerFactory('foodvoucher')` → `FoodvoucherProvider.create()` → `createCakeuncleClient()` + `createPorts()` → `ExtensionRegistry.register()`。

`ProviderFactories.ts`将`FoodvoucherProvider`列为生产工厂。`ProviderLoader.ts`对每条已启用安装读取manifest、连接和Secret后构造并注册该Provider；没有按Cakeuncle发布说明削减能力的运行时闸门。

## 重新取证

1. `extensions/providers/foodvoucher/manifest.ts:12-16` 对外声明`Catalog/Issue/Bind/Verify/Void/Extend/Refund/Statement/Webhook`，并订阅`ProviderWebhookReceived`。
2. `extensions/providers/foodvoucher/Provider.ts:6-16` 映射`voucher.issue`、`voucher.void`、`voucher.refund.submit`、`voucher.statement.pull`、`voucher.verify`，再以连接secret调用通用ports工厂。
3. `extensions/providers/core/src/PortFactory.ts:20-53,72-97` 因此实际创建order、cancel、refund、statement、verification和header-HMAC webhook端口；它不是Cakeuncle专用协议适配。
4. `extensions/vendors/cakeuncle/README.md:14-27` 将Foodvoucher限定为Catalog/Price，并明确卡券发放与Webhook未发布：生产订单为HTTP、回调未签名、AES契约不完整；`index.ts:1-7`也未导出专用Webhook实现。

## 结论边界

这证明生产可加载的能力表面和供应商包自己的可发布边界相互矛盾。若Foodvoucher安装被启用，运行时可把未经核实的写入与回调能力交给上游；其中真实静态调用已确认可达的为Statement和Webhook，不能把未找到固定调用方的端口描述为正在运行。

没有读取线上enabled installation、近期任务结果、真实供应商协议或入站请求。因此不能证明当前发生重复发券、资金损失或回调攻击；结论维持P1而非P0。后续治理应先做线上只读状态与供应商协议核对，再按单能力收敛manifest/ports，不在本审计分支修复。
