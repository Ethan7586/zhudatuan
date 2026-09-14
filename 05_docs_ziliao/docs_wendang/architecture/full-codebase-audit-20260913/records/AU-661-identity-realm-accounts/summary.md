# AU-661｜Identity Realm / Account 初始迁移

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260907120000_create_identity_realm_accounts.sql`（345 行）。
- 审阅方式：逐段人工审阅 Realm、Account、membership/credential/federated identity 回填、Owner transfer trigger、RLS 与断言；反向检查当前 Identity registration/SMS 登录查询和后续多 Realm 运行时迁移。未执行数据库迁移或真实登录。

## 审计结论

- **G0：保留。** 此 migration 是旧 Principal 模型向 Realm-bound Account、凭据和 membership 的基础数据迁移，并建立后续 Identity session、登录和跨 Realm member 关系所依赖的复合外键与唯一性约束。
- [FACT][E-AU-661-001] `identity.realm`、`identity.realmentry`、`identity.realmtarget` 与 `identity.account` 将登录入口、目标、账户和历史 principal 分离；`access.membership`、`identity.credential` 与 `identity.federatedidentity` 使用 `(account_id, realm_id)` 复合外键，阻止账户跨 Realm 误绑定。
- [FACT][E-AU-661-002] 回填先按历史 principal 建立每 Realm 一个 account，再将 credential 映射到排序首个 Realm 并克隆至其他同 principal account。尾部断言要求每一个回填 account 均有对应 provider/subject 凭据；后续 `identity.realm_contains_account_realm()` 及注册运行时明确以 Realm 作为凭据查找边界，故这不是可删除的重复数据，而是身份域拆分时保留原有登录能力的迁移语义。
- [FACT][E-AU-661-003] Owner transfer snapshot trigger 改为锁定目标 account/realm 的活跃 password credential，并在接受时复验 membership、principal、credential 和 access version，避免历史 principal 层级的凭据变化绕过 owner-transfer 完整性检查。
- [FACT][E-AU-661-004] L1 初始化的 `console-hbbtzn` 与 `storefront-hbbtzn` target 与 AU-660 已记录的 F-0274 应用层 parser 不匹配；本 AU 只提供该不匹配的 seed 数据证据，不重复计数。
- [FACT][E-AU-661-005] `shopjob` 与 `zhudatuanidentityapi` 的 Realm/Account RLS policy 使用无条件 `using(true)`；这与既有 F-0264 的跨域数据库读取风险为同一权限边界，不重复计数。

## 未验证项

- 未在基线数据库抽样校验一个 principal 同时具备 L0/L1 membership 时的 credential 克隆数量与实际登录选择；迁移断言只验证覆盖存在性，不验证业务样本。
- 未执行受控 migration runner，故未验证其精确 predecessor/checksum gate 与数据库角色在真实环境的行为。

## 结论等级

- 新增问题：无。无 P0。
- 已关联问题：F-0264、F-0274。
- 垃圾代码：G0 1 项（Realm/Account schema 与历史数据迁移）；不新增 G1/G2/G3/GX。
- 二次复核：否；若处理 F-0274 或 F-0264，需将本 migration 的 L1 seed/RLS 契约纳入复核样本。
