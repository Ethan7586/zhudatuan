# AU-586｜Storefront Compatibility 加密地址簿迁移

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260725100000_encrypted_address_book.sql`（54 行）。
- 审阅方式：逐行人工审阅数据归属、cipher storage、default index、upsert scope/transaction、audit和 address routes 加解密调用。未读取真实地址或执行 RPC。

## 审计结论

- **G0**：该迁移是当前地址簿读写与收件人 PII 边界的真实运行责任，不能删除。
- [FACT][E-AU-586-001] delivery address 按 tenant/enterprise/mall/user 归属，数据库仅保存 `recipient_cipher` JSON；部分唯一索引保证同一 mall/user 至多一个默认地址，owner index支持范围读取，RLS启用且 table直接访问未授权。
- [FACT][E-AU-586-002] upsert 仅能更新相同完整 owner scope 的 existing ID；跨属主 ID 触发 `ADDRESS_NOT_FOUND` 并回滚此前的 default 变更。设置默认地址先清除此 owner defaults，随后写入在同一 PL/pgSQL transaction 中完成并记录 audit。
- [FACT][E-AU-586-003] `addressRoutes.ts` 在 GET/PUT 强制 PII encryption key；Worker 对 address fields AES-GCM encrypt后调用 write RPC、读取后才为当前会话 decrypt，且 router的输入校验完整 name/phone/region/detail。删除由 later受限 RPC 处理。
- Compatibility 与 Canonical 同名 migration SHA-256 一致，但各数据库地址数据和 migration ledger隔离。

## 未验证项

- 未验证实际 AES key lifecycle/rotation、cipher JSON schema/空 object异常、并发默认切换、跨 tenant/mall/enterprise response和真实 RLS/privilege。
- 未读取 address deletion、order snapshot/backfill migration与远端历史数据；本单元不将 Worker input validation 误报为数据库层完整 PII content schema保证。
