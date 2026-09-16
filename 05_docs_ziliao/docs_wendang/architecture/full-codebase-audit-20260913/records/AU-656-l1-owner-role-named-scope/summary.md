# AU-656｜Add L1 Owner Role and Named Scope

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260906010000_add_l1_owner_role_and_named_scope.sql`（126 行）。
- 审阅方式：逐段人工审阅 L1 Owner role、scope object resolution、Mall Owner provisioning function、backfill 与 access-version invalidation；交叉检查 provision API privilege、port 与 CreateMall plan。未执行数据库。

## 审计结论

- **G0：保留。** migration 建立 Tenant-scoped L1 Owner role，复制 Platform Owner 的 allow permissions但显式排除 ownership capability；Mall Owner membership 另以 Mall assigned scope 与 owner/self grants 限定数据边界。
- [FACT][E-AU-656-001] `access.provision_mall_owner` 首先绑定 active operator source membership 与同一 active principal，才创建 membership、self/L1 role、Mall/owner/self grants 与 `access.mallowner` projection。后续 dedicated provisioning migration 已撤销 public 并只授予 `zhudatuanprovisioningapi` execute，runtime readiness 同时确认该 role 没有 membership/mallowner 直接表权限。
- [FACT][E-AU-656-002] CreateMall 的 plan 为 Mall、organization、scope 生成同一 stable Mall ID，并将该三者原样传给 Owner provision port；因此该函数的参数语义与唯一实际应用调用一致。
- [FACT][E-AU-656-003] historical Mall Owner backfill 只限 `tenant-zhudatuan` closure 内 active membership且不重复生效角色，并递增对应 access version，使旧会话不能继续消费旧权限快照。

## 未验证项

- 未在真实数据库检验 provision transaction 的全量原子性、重复 stable ID、跨 Tenant source membership 和失败回滚。
- 未核验历史已存在 Mall Owner 的实际 backfill 数量；当前仅核验 SQL guard及运行调用拓扑。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本 migration；历史 Owner role/provisioning compatibility，不可按后续专用 migration 覆盖而删除）。
- 二次复核：否。
