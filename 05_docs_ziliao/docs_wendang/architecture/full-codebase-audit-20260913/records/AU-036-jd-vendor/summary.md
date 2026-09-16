# AU-036｜JD Vendor Adapter 深审

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`01_core_hexin/extensions/vendors/jd`
- 覆盖：8/8 文件、33 行人工关键实现逐项审阅。
- 运行链：Commerce `ProviderLoader` → `JdproductProvider` / `JdfreshProvider` → `VendorClient` → `createJdAuth`（`createJdClient`）

## 结论

- F-0134/P3｜JD vendor 认证测试覆盖不足
  - `extensions/vendors/jd/tests/Auth.test.ts` 仅验证“任一签名字段缺失都会抛错”，没有细分 `keyId` 与 `privateKey` 的差异错误码；也未覆盖 `createJdClient` 的工厂行为和主要业务 operation 的端到端工厂/调用闭合。
  - 这类覆盖缺口意味着 `createJdClient` 与端口闭合变化可能在单元测试仍通过时才暴露到线上路径。

- DC-0043/G1｜JD vendor adapter 转发导出未形成仓内直接调用证据
  - `Signer.ts`、`RatePolicy.ts`、`CircuitPolicy.ts` 为 `@shop/vendorcore` 的包装转发，并由 `index.ts` 统一导出。
  - 当前仓内检索没有到这些符号的直接生产调用（仅通过公共出口暴露）；该模块仍承担兼容/API 公开职责，**不满足 G3 删除条件**。

## 保留与边界

- `createJdClient` 与 provider 工厂（`@shop/providerjdproduct`、`@shop/providerjdfresh`）的调用链已闭合；`createJdAuth` 密钥字段与两个 JD provider manifest 的 `secretRefs` 一致。
- 未见 P0 级安全/数据事故证据。未执行任何修复、删除、推送、合并或部署。
