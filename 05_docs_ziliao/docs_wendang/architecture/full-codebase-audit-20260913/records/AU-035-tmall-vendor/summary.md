# AU-035｜Tmall Vendor Adapter 深审

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`01_core_hexin/extensions/vendors/tmall`
- 覆盖：8/8文件、全部关键调用链逐项人工阅读并映射到 `TmallmarketProvider`。
- 运行链：Commerce `ProviderLoader` → `TmallmarketProvider` → `createTmallClient` → `VendorClient`（通用签名/限流/熔断 + HTTP 发送）→ `extensions/vendors/tmall`。

## 结论

- F-0133/P3｜`tmall` vendor 包测试不能验证关键认证约束和端口适配行为
  - `extensions/vendors/tmall/tests/Auth.test.ts` 仅验证“字段缺失时会抛错”这一条路径，未覆盖 `keyId` 与 `secret` 各自缺失的差异码路径，也未覆盖 `createTmallClient` 的 factory 返回类型与 `VendorClient.invoke` 端口语义（`tracking/statement/refund` 等关键 `operation`）。
  - 对该风险的直接影响是“改造或回归时，`manifest`侧契约与厂商适配器链路容易被测试遗漏而只在运行期暴露”。

- DC-0042｜`extensions/vendors/tmall` 的通用转发导出未形成独立运行消费证据
  - `Signer.ts`、`RatePolicy.ts`、`CircuitPolicy.ts` 都是 `vendorcore` 的直接转发别名，但全仓暂未找到内部调用点（仅 `index.ts` 导出）。当前证据不足以支持直接删除；
    暂标记为 G1 候选，待确认是否存在外部兼容路径或运行时保留要求。

## 备注

- 与本次审计范围相关的缺陷已按 P0/P1/P2/P3 入库；未发现需要立即停止的线上重大事故证据。未执行任何修复、删除、推送、合并或部署。
