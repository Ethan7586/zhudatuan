# AU-038｜Wenxuan Vendor Adapter 深审

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`01_core_hexin/extensions/vendors/wenxuan`
- 覆盖：9/9文件、45行人工关键实现逐项审阅。
- 运行链：`book Provider` → `VendorConnection` → `createWenxuanClient`

## 结论

- F-0136/P3｜Wenxuan vendor 认证测试覆盖不足
  - `extensions/vendors/wenxuan/tests/Auth.test.ts` 仍只验证“缺少字段会抛错”，未细分 `keyId` 与 `secret` 的错误码差异，也未覆盖 `createWenxuanClient` 与 book provider 操作链路的闭合行为。
  - 这类覆盖缺口会掩盖认证字段变更与 provider 端口行为变更的组合风险。

- DC-0045/G1｜Wenxuan vendor 转发导出未形成仓内直接调用证据
  - `Signer.ts`、`RatePolicy.ts`、`CircuitPolicy.ts` 仍为 `@shop/vendorcore` 的转发导出，由 `index.ts` 统一暴露，当前未见仓内生产/测试直接调用。
  - 存在公共导出兼容职责，不能直接判定 G3 删除。

## 保留与边界

- `createWenxuanClient` 与 `book Provider` 的 `createPorts`/`createWenxuanClient` 链路已闭合验证。
- 未见 P0 级安全或数据事故证据。未执行任何修复、删除、推送、合并或部署。
