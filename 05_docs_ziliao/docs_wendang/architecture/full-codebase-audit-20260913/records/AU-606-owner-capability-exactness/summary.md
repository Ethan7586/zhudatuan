# AU-606｜Owner 能力精确性

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260829216000_owner_capability_exactness.sql`（213 行）。
- 审阅方式：逐行人工审阅 migration boundary/checksum guard、public capability entitlement 回收、Owner permission/entitlement/有效操作集不变量及 deferred constraint trigger 强制校验；交叉检查 AU-600 的六个 trigger 注册、Owner transfer/runtime boundary 链和后续 AU-607 predecessor。未连接数据库或执行迁移。

## 审计结论

- **G0：保留。** 该 migration 将 Platform Owner 的常驻 entitlement 从“含有非公开 operation 的 capability”精确收敛为同一集合，移除仅包含 public operation 的历史 entitlement；不能按孤立 SQL 或无应用层文件引用视为闲置。
- [FACT][E-AU-606-001] 仅允许 registration 数据库的 `shopmigration` 或超级用户执行；要求 AU-605 的精确 schema marker、拒绝 future head，并要求 runtime contract checksum 为已知值，因此未知历史链或目录漂移会 fail closed。
- [FACT][E-AU-606-002] 回收条件限定为 platform-root、enabled、epoch 生效且永不过期的 canonical entitlement，且 capability catalog 中不存在 active non-public operation；不会删除带有非公开能力或时效/配额语义的其它 entitlement。
- [FACT][E-AU-606-003] 重新定义 `access.enforce_platform_owner_operator_coverage()`，以 active non-public operation 计算 Owner 的 permission 与 entitlement 精确集合，并在 active Owner 存在时检查 resolved deny overlay 与 `capability.membership_operations()` 的实际可执行集合。
- [FACT][E-AU-606-004] AU-600 已在 permission、role、rolepermission、capability、entitlement、operation 六张表注册 deferred constraint trigger；本 migration 以无语义变更的 Owner role update 排队并强制立即验证，确保本事务不会提交半完成集合。AU-607 以本 migration marker 为严格 predecessor，故它具有 migration ledger 的真实运行责任。

## 未验证项

- 未在真实数据库执行 public-only capability entitlement 回收、deferred trigger 失败路径或实际 Owner session 的 operation 计算；RLS、历史 entitlement 数据和部署迁移时序的线上状态均未验证。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；任何改变 operation audience、capability status 或 Owner entitlement 的后续迁移应同时验证 public-only capability 回收与 effective Owner 的 resolved operation 集。
