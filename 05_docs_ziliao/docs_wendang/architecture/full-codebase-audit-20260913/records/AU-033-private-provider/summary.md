# AU-033｜Private Provider 深审

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`01_core_hexin/extensions/providers/private`
- 覆盖：9/9文件、77/77行深入审阅。
- 运行链：Commerce entry/bootstrap/RuntimeExtensionLoader → ProviderLoader(local分支) → PrivateProvider → createPrivateProviderInstallation（channel数据库函数）→ channel.pull_* / channel.submit_*。

## 结论

- F-0127/P1：`manifest`声明`Shipment`与`Return`，但`Provider.ts`仅发布`order/cancel/tracking/refund/catalog/stock/statement`端口。`FulfillmentJobs`固定调用`Order + Logistics`；`ExtensionRegistry`按 capability 先验校验后才做port访问，`private`安装一旦启用将导致`tracking`不可达（`Logistics`未声明）。
- F-0128/P2：`manifest`声明能力集与端口口径不闭合，`Shipment`缺专用port映射、`Return`未实现专用port。尽管当前固定caller未引用`Return`，但运行契约仍未形成“声明即可达”的一一映射。
- F-0129/P3：测试仅核验`required ID`与`manifest`签名；未实例化factory，不覆盖`tracking/order/stock`、`statement`、`manifest×registry×caller`矩阵与失败映射。
- DC-0040/G1：`mapPrivateError`目前为全仓静态零caller；但package barrel公开导出且仓外兼容/替代路径未排除，不可判定删除。

## 保留设计

- `local` transport 的建模与`providerFactory`注册链路合理；`create`将`health`与`local.ports`直接注入 Provider 实现，并对`private`安装支持无 secret 的本地配置入口。
- `ProviderLoader` 对`factory.transport==='local'`分支在私有provider下仅复用共享`createPrivateProviderInstallation`，其能力与channel函数映射清晰。

## 验证状态

- 正式`test/typecheck`与`npm run typecheck`在审计工作树缺`vitest/tsc`时退出 127；未安装依赖。
- 未访问线上`extension.enabled_installations()`或真实 channel DB 变更，仅以静态链路和入口映射验证。
- 未修改实现，也未推送、合并、修复、部署。
