# AU-587｜Storefront Compatibility 地址簿删除迁移

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260726110000_delete_delivery_address.sql`（22 行）。
- 审阅方式：逐行人工审阅删除 scope、input rejection、audit与 Commerce API caller；未执行删除。

## 审计结论

- **G0**：这是地址簿真实删除入口，不能删除。
- [FACT][E-AU-587-001] RPC 拒绝空 address ID；DELETE 同时匹配 address ID 与 tenant/enterprise/mall/user，跨属主或不存在的 ID 返回 false且不写审计；成功才写 `address.deleted` audit fact。
- [FACT][E-AU-587-002] `addressRoutes.ts` DELETE 实际调用该 service-role RPC，先要求 `orderCreate` permission并将当前 authorization scope传入；未暴露给 anon/authenticated。
- [FACT][E-AU-587-003] 删除的是地址簿记录，不修改订单的加密 recipient snapshot；历史订单地址/PII后续迁移仍需单独审计。Compatibility 与 Canonical 同名 migration SHA-256一致但隔离 replay。

## 未验证项

- 未在真实数据库验证已被订单引用的地址是否存在 FK/业务快照依赖、审计写入失败的 transaction语义、同一地址并发删除或实际 retention/erasure policy。
- 未核验 service-role credential边界、address route E2E、RLS以及远端存储是否遵守合法的数据删除/保留要求。
