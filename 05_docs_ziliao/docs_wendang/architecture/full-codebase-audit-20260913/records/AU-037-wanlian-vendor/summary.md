# AU-037｜Wanlian Vendor Adapter 深审

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`01_core_hexin/extensions/vendors/wanlian`
- 覆盖：9/9 文件、45 行人工关键实现逐项审阅。
- 运行链：`directcharge/movie Provider` → `requireConnection` → `VendorConnection` → `createWanlianClient`

## 结论

- F-0135/P3｜Wanlian vendor 认证测试覆盖不足
  - `extensions/vendors/wanlian/tests/Auth.test.ts` 仍只验证“空输入会抛错”，没有区分 `keyId` 与 `privateKey` 的错误码分支，也未覆盖 `createWanlianClient` 工厂闭合到生产端口行为。
  - 这会导致字段级配置变更或厂商认证行为变动在包级测试中不被识别，才在 provider/runtime 被动暴露。

- DC-0044/G1｜Wanlian vendor 转发导出未形成仓内直接调用证据
  - `Signer.ts`、`RatePolicy.ts`、`CircuitPolicy.ts` 为 `@shop/vendorcore` 的包装转发，并由 `index.ts` 收口导出。
  - 固定仓内检索未见三者直接生产调用；该模块仍承担公共出口兼容职责，当前不满足 G3 删除条件。

## 保留与边界

- `createWanlianClient` 与 directcharge、movie provider 链路已核验闭合，`manifest.secretRefs` 与 `webhookSecret` 要求保持一致。
- 未见 P0 级安全/数据事故证据。未执行任何修复、删除、推送、合并或部署。
