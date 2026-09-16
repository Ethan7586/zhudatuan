# RV-0018｜Foodvoucher 只读能力与健康检查独立复核

- 复核日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应首审：F-0103
- 结论：**确认 P1；未发现 P0。**
- 方法：从需求定义、发布校验和同步运行入口重新取证；未访问线上、供应商或数据库。

## 运行与发布链

`RequirementSource.PROVIDERS(priority 1)` → `RequirementGenerator` → `REQUIRED_PROVIDER_IDS` → `release/stage.validateStage()`；同时，`ChannelSyncJob`分别通过Registry要求`Catalog/catalog`与`Price/price`。

Foodvoucher是priority-one的虚拟食品提货券供应商。生成器把所有priority-one供应商标为`delivery: required`和`available: true`；正式stage要求每个required provider给出沙箱、对账和回滚证据。这是当前代码的发布门槛，而不是历史文档承诺。

## 重新取证

1. `ChannelSyncJob.ts:55-92` 固定分别请求Catalog和Price；前者写入源目录，后者写入价格簿。
2. `providers/foodvoucher/manifest.ts:12` 只包含Catalog及写入/对账/回调能力，不包含Price；`Provider.ts:6-16`也没有price operation。因此Price run必在Registry能力检查时失败，不会访问供应商。
3. `providers/foodvoucher/Mapper.ts:1` 只是`CanonicalSourceMapper`；`PortFactory.ts:56-65`要求远端返回`value.records`，每条记录含`externalId/version/payload`。`CakeuncleClient.ts:151-164`只剥离业务失败并返回原始成功envelope，没有Foodvoucher响应转换。
4. `CakeuncleClient.health():55-63` 只调用安装配置的`healthOperation`，不执行Catalog或Price映射。`providers.spec.ts:35-53`与`ProviderContract.ts:10-50`只验证ports存在，Foodvoucher手写期望同样未列price，不能阻止该情况进入绿色测试。

## 结论边界

Foodvoucher被当前发布控制面定义为必须可交付的供应商，而它的实际只读同步契约不完整，健康信号也不能证明目录或价格可用。这确认P1：若启用并调度价格同步，会稳定失败；若只通过health/结构测试，可能被误判为可交付。

审计未读取线上enabled installation、Job执行历史、stage证据或供应商当前响应，不能证明已有用户可见目录或价格缺失，故不是P0。后续应先以只读方式确认线上状态和供应商协议，再以单一小批次补齐或明确下线只读能力；不要与F-0100的写入/Webhook治理混合。
