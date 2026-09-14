# AU-076｜finance 发票外部适配器与签发任务深审

- InvoiceGateway 使用 provider request idempotency、HTTPS/bearer/provider 格式、PDF content type 和 magic header 验证；其外部 API 合约仍无专用行为测试。
- InvoiceJobProcessor 直接更新 `invoice.request`、插入 `invoice.document`/`invoice.statusevent`；但 20260828094000 migration 已撤销 `shopjob` 对这些表的直接写入，要求 worker 通过 claim/register/finalize/fail 函数。
- Commerce jobs runtime 明确以 `shopjob` 建池并注册 InvoiceJobProcessor；PGlite integrity test 将期望完整签发行为标记为 `it.skip` 且注释“未实现”。直接运行时阻断与缺失的 claim/snapshot/artifact 交接构成 F-0158/P1 候选，已进入 AU-077 独立复核。未发现 P0。
