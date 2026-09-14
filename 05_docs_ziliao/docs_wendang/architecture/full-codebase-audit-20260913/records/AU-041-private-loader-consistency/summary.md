# AU-041｜Private provider 本地 loader 与履约追踪调度一致性复核

## 1) 范围与证据

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 复核目标：对 `AU-033` 的 `F-0127/F-0128/F-0129` 做 P1 级二次独立复核（私有 provider + fulfillment 调度）
- 核验文件：
  - `01_core_hexin/services/commerce/src/bootstrap/ProviderLoader.ts`
  - `01_core_hexin/services/commerce/src/modules/channel/04_adapters_shixian/adapter/PgPrivateProvider.ts`
  - `01_core_hexin/extensions/providers/private/manifest.ts`
  - `01_core_hexin/extensions/providers/private/Provider.ts`
  - `01_core_hexin/services/commerce/src/modules/fulfillment/05_interface_jieru/jobs_renwu/FulfillmentJobs.ts`
  - `01_core_hexin/extensions/providers/core/src/Provider.ts`

## 2) 关键复核结论（独立复核）

- [E-AU-041-001] **复核通过：`ProviderLoader` 的 local 分支确实会走 `createPrivateProviderInstallation` 注入 `local` 端口**。
  - 证据：`ProviderLoader` 在 `factory.transport === 'local'` 时注入 `local: createPrivateProviderInstallation(this.pool,row.scope_id)`（`ProviderLoader.ts:43-46`）。
  - `PrivateProvider` `create()` 通过 `requireLocal(installation)` 接管 `local.ports`。

- [E-AU-041-002] **复核未变更：`private` 供应商 manifest 仍声明 `Shipment` 与 `Return`，但运行侧只有 `tracking` 与 `refund` 端口**。
  - 证据：`manifest.ts` 列表为 `['Catalog','Inventory','Order','Shipment','Return','Refund','Statement']`。
  - `createPrivateProviderInstallation` 当前端口为 `catalog/stock/order/cancel/tracking/refund/statement`。

- [E-AU-041-003] **复核未变更：`fulfillment` 跟踪任务要求 `capability='Logistics'` 且端口 `tracking`**。
  - 证据：`FulfillmentJobs.ts:66` 调用 `extensions.require(loaded.provider, loaded.provider_scope_id, 'Logistics', 'tracking')`。
  - 与 `extension.require()` 行为匹配：先验能力校验与端口读取为一一匹配（`ExtensionRegistry.ts`）。

- [E-AU-041-004] **结论：`F-0127` 的实质风险仍在，属于二次复核确认项，而非本次单元新增问题**。
  - 说明：private manifest 的能力声明与当前 fulfill/物流调用能力存在 `Shipment/Logistics` 与 `tracking` 语义失配；即使 local 实现有 `tracking` 端口，`ExtensionRegistry.require` 仍会在能力检查阶段拒绝 `Logistics`。
  - 该风险与 `AU-033` 同源，未被 AU-041 的 local loader 一致性范围内消解。

- [E-AU-041-005] **复核确认：`F-0129` 的测试覆盖不足并未由本单元补齐**。
  - `private` 测试只覆盖 manifest/required-id 级别，不覆盖 `tracking/order/statement/catalog/stock` 与 `manifest×registry×caller` 组合。

## 3) 风险与建议

- 不改代码前提下：
  - [P1][F-0127] 维持；需在能力/能力映射上修复（建议后续改造：`Shipment` 与实际使用的 `Logistics+tracking` 建立明确映射或调整调用侧）。
  - [P2][F-0128] 维持；`Shipment` / `Return` 与 `private` 实现口径仍不闭合。
  - [P3][F-0129] 维持；测试矩阵仍偏窄。
- `AU-041` 仅做一致性复核，不涉及实现改动。
