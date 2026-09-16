# AU-641｜Provision L1 Mall Owner

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260903103000_provision_l1_mall_owner.sql`（162 行）。
- 审阅方式：逐段人工审阅 mall owner relation、security-definer create/read functions、ACL、runtime operation/entitlement/assertions；交叉追踪 `CreateMall` → provisioning port → DB function 与 provisioning runtime readiness。未连接数据库或执行 migration。

## 审计结论

- **G0：保留，但受既有 F-0266 阻断。** 此 migration 首次定义 AU-628 已提前 grant 的 two provisioning functions；它在逻辑上建立 source operator membership 到新 Mall owner membership/self role/mall-owner/self scope 的原子 relation，并把写能力只授予 provisioning API role。
- [FACT][E-AU-641-001] `provision_mall_owner` 先校验 source operator membership、active profile/principal 与 principal 参数一致，随后创建目标 membership、`role:self`、mall/owner/self grants 和唯一 `access.mallowner` row；所有命令由 `CreateMall` 将 authenticated plan 的 actor/membership 与已创建 mall identifiers 传给 port。
- [FACT][E-AU-641-002] `read_provisioned_mall` 只在 mall owner、source binding、owner membership/profile/principal、draft/valid experience application/version 与 active catalog binding/pool 完整同时存在时返回 ready record；read/create function 均 revoke public、仅 grant `zhudatuanprovisioningapi`，migration assert 同时检查无底表 ACL 泄漏。
- [FACT][E-AU-641-003] `MallProvisioningApiRuntime` Ready gate 检查 relation、两 function、privilege、schema and provisioning contract；read operation、capability、platform entitlement 已同步注册。
- **F-0266（P2，已登记）**：该文件才首次创建 function，但早于它的 AU-628 migration 已对同 signatures 执行 grant；标准 sorted runner 会先失败，因而本 migration/function/readiness chain 在空库无法到达。此 AU 重新独立确认定义、grant 和 runner 证据，不重复计数。

## 未验证项

- 未在隔离 PostgreSQL 验证 source/target duplicate、cross-scope parameter、partial transaction failure 和 provisioning role only call matrix。
- 未确认现网 schema ledger 是否已跨过 F-0266 的历史顺序阻断。

## 结论等级

- 新增问题：无；关联 P2 1 项（F-0266）。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：沿用 F-0266；复核者须以正式 runner 在 clean DB 重走顺序并核对 deployed ledger。
