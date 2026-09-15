# RV-0077｜Provider 履约 capability 矩阵独立复核

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`；仅静态审阅，未连接供应商、数据库或线上安装。
- 范围：F-0116（Book）、F-0119（Directcharge）、F-0122（Jdfresh）、F-0127（Private）。公共 Registry 只深审一次；逐一核对四个 manifest、factory、Loader 与固定调用者。

## 共同运行边界

- 四个 factory 都在 `ProviderFactories` 注册。`RuntimeExtensionLoader` 只会将数据库 `extension.enabled_installations()` 返回的记录注册进运行 Registry；仓库无法证明任一 provider 当前线上启用。
- Registry 先校验 capability，再取得 port；Fulfillment 固定用 `Order/order` 提交、用 `Logistics/tracking` 查询。Jdfresh 的 Channel 同步固定用 `Inventory/stock`。

## 逐项结果

| 问题 | 独立证据 | 结论 |
| --- | --- | --- |
| F-0116 Book | manifest 有 Order、无 Logistics；factory 有 order/tracking | 提交可达；启用后的 tracking 在供应商调用前被拒绝，P2 |
| F-0119 Directcharge | manifest 无 Order/Logistics；factory 有 order/tracking | 启用后的 submit 与 tracking 均被拒绝，P2 |
| F-0122 Jdfresh | manifest 用 GeoStock/Delivery；factory 有 stock/tracking | 启用后的库存同步和 tracking 均被拒绝，P2 |
| F-0127 Private | manifest 有 Shipment、无 Logistics；local ports 由 enabled installation 装载 | 启用后的 tracking 被拒绝，P2 |

## 结论

- 四项静态 defect 均确认，但均**从 P1 候选降为 P2**：当前代码可达不等于存在已启用安装、已提交外部订单或正在失败的线上任务。无 P0 证据。
- 不能以逐个 provider 临时加 capability 绕过。后续从最新主线建立单一契约治理批次，先定义 capability-to-port 权威映射，再在隔离环境按四个 provider 的安装状态验证 submit/inventory/tracking 与重试/回滚。
- 本次未修改 provider、Registry、测试、配置或外部状态。
