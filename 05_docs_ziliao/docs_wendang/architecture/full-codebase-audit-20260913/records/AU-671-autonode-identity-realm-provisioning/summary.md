# AU-671｜Autonomous Node Identity Realm Provisioning

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260909062000_provision_autonode_identity_realm.sql`（207 行）。
- 审阅方式：逐段人工审阅 Realm fact 校验、幂等/冲突、entry/target projection、disable path、privilege 与 runner health probe；反向检查 provisioning role 及 hosted-node contract。未执行数据库供给或禁用操作。

## 审计结论

- **G0：保留。** 此 migration 将 autonomous node 的 Identity Realm 作为由签名 fact 驱动、可追溯、可禁用的供给单元，而非开放表写入。
- [FACT][E-AU-671-001] `identity.provision_node_realm` 校验 schema version、Realm profile shape、manifest digest、entry/target JSON 类型；以 activation request advisory lock 和 nodeprovisioning 唯一键实现同 fact 重放幂等、不同 fact 冲突拒绝。
- [FACT][E-AU-671-002] 首次供给在一个事务内写 Realm、active entry、profile-matched target 和 provisioning ledger；随后以 fact 数量反查 entry/target drift。disable path 不删除身份记录，只禁用 Realm/entry/ledger，保留恢复与审计线索。
- [FACT][E-AU-671-003] 只有 `zhudatuanprovisioningapi` 可执行两个 SECURITY DEFINER function，不能直接读写 ledger；migration assertion 与 RegistrationMigrationRunner health probe 都验证该最小权限边界。

## 未验证项

- 未以真实 provisioning API role 调用有效 fact、重放、冲突 fact、disable/re-enable 和 malformed entry/target matrix。
- 未核对 fact 的上游签名/manifest 生成器，故不对其来源真实性作事实结论。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（autonomous node Identity Realm provisioning/disable boundary）；不新增 G1/G2/G3/GX。
- 二次复核：否。
