# AU-600｜Owner Operator 覆盖迁移

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260829210000_owner_operator_coverage.sql`（298 行）。
- 审阅方式：逐段人工审阅 database/ledger guard、catalog guard、Owner role/entitlement 投影、effective coverage function、六个 deferred constraint trigger 与最终断言；交叉检查 registration migration plan、owner bootstrap 与 Access role guard。未连接数据库或执行迁移。

## 审计结论

- **G0：保留。** 本 migration 将 platform Owner 对 active 非 public operation 的权限和 platform-root entitlement 维持为精确投影，且防止后续目录/角色/entitlement 漂移；这是 Console Owner 可用性和最小授权目录一致性的数据库边界。
- [FACT][E-AU-600-001] boundary guard 要求独立 registration database、已知 predecessor/可选 predecessor checksum、无未知 future head 和 active `role-platform-owner-v2`；catalog guard 会拒绝缺 capability、无 permission 或 inactive catalog 的 operator operation。
- [FACT][E-AU-600-002] migration 删除 Owner role 的 stale/deny/missing mapping 后，按 active `capability.operation` 和 permission/capability 状态重新投影全部 `audience<>'public'` 权限；epoch platform-root entitlement 同步为 enabled。它明确包含 member-audience Console 读取，以保持 capability resolver 的可执行表面一致。
- [FACT][E-AU-600-003] `access.enforce_platform_owner_operator_coverage` 比较 expected/actual permission 集、拒绝 deny overlay、校验 entitlement；若动态 singleton 已存在，还检查 effective owner 的 resolved denies 与 `capability.membership_operations`。六个 deferrable initially-deferred constraint trigger 覆盖 permission、role、rolepermission、capability、entitlement、operation，允许单事务有序变更但禁止不完整 commit。
- [FACT][E-AU-600-004] registration migration plan、owner bootstrap、Access operation safeguards 都引用该 Owner role；这不是单纯的角色初始化文件。未发现此 migration 本身绕过 RLS 或将 public operation 纳入 Owner 覆盖的证据。

## 未验证项

- 未运行迁移或 deferred trigger，未验证实际 platform owner singleton、所有 capability catalog、角色继承/RLS、Console effective permissions 或部署数据库中的历史 entitlement。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；任何 capability/permission 目录修改应在隔离数据库提交整个变更事务，并验证 Owner expected/actual/effective coverage 的 allow/deny 反事实。
