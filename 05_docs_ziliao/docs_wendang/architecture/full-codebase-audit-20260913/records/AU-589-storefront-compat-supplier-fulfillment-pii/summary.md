# AU-589｜Storefront Compatibility 供应商履约 PII 边界迁移

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260809094000_supplier_fulfillment_pii_boundary.sql`（67 行）。
- 审阅方式：逐行人工审阅子订单 PII snapshot、trigger/backfill/NOT NULL、供应商最小读取 RPC 和仓内调用；未读取任何收件人数据或运行 SQL。

## 审计结论

- **约束/trigger/backfill G0；履约 RPC G1（DC-0073）**：每个 sub-order 持有自己的加密 recipient snapshot，避免供应商读取包含其他供应商商品的 parent order；这是明确 PII 最小化和历史数据责任，不能删除。固定基线没有该 RPC 的仓内供应商 route caller，但外部履约消费者未排除，故保守列为 G1。
- [FACT][E-AU-589-001] insert/update trigger 从同 tenant/mall 的 parent order复制 recipient snapshot，无法找到时拒绝；历史 sub-order回填后字段改为 NOT NULL。
- [FACT][E-AU-589-002] `api_supplier_fulfillment` 只按 tenant + supplier + sub-order ID 返回该子订单状态和密文快照，直接表权限不给 anon/authenticated，RPC仅 service_role。
- [FACT][E-AU-589-003] 固定基线没有 Commerce API supplier HTTP route/test 调用；但函数是 Compatibility 数据库唯一显式供应商最小 PII read shape，外部履约/历史部署不可排除。Canonical与Compatibility同名 migration SHA-256一致但两库不可混跑。

## 未验证项

- 未核验 service-role credential到真实供应商适配器的授权、收件人解密边界、operator audit、外部履约契约或供应商撤销后的历史访问。
- 未运行 backfill/trigger，未验证遗留 parent/suborder tenancy mismatch、失败回滚或复制后的 PII retention/erasure要求。
