# AU-598｜Owner 身份重置基础迁移

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260829200000_owner_identity_reset_foundation.sql`（190 行）。
- 审阅方式：逐行人工审阅 reset operation/event/permission/capability/scope patch、root-owner protective trigger、事务 guard test 与最终断言；交叉检查 CredentialOperations、Console UI、SDK、contract 和 identity tests。未连接数据库或执行身份重置。

## 审计结论

- **G0：保留。** 此 migration 是 target-membership registration reset 的正式 operation/authorization/data-protection 基础，不能删除；它同时防止现存 active platform owner 被重置流程间接失活或移除。
- [FACT][E-AU-598-001] `identity.members.reset` 是实际 SDK、Console 与 `CredentialOperations` 路由；对应 `identity.registration.reset` permission 被清除出所有非 platform-owner role，operation scope 通过 target membership 的 organization 解析，而非简单沿用 actor scope。
- [FACT][E-AU-598-002] 五个 BEFORE trigger 分别保护 active root owner 的 membership、role assignment、principal、profile 与 active credential；guard test 在 migration 内尝试将 owner membership 设为 left、role 设为 expired，并要求收到保护异常。
- [FACT][E-AU-598-003] migration 在 runtime/capability/entitlement 注册 event 与 operation，且最终断言验证独占权限映射、resource scope patch、五 trigger 和 schema marker；这使 route、授权与数据库保护处于同一历史变更链。
- [FACT][E-AU-598-004] 自定义 role 可能承载 Owner-only 权限的更广泛风险已经由 F-0038 独立记录；本单元未得到新的 root-owner bypass 或线上事故证据，故不重复新增 finding。

## 未验证项

- 未执行 target member reset、self/root-owner reset、事务回滚、跨组织授权拒绝或生产 RLS/trigger 状态；实际用户身份数据和线上影响未知。

## 结论等级

- 新增问题：无；既有关联项：F-0038。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；任何 reset 逻辑变更应在隔离 PostgreSQL 覆盖 root owner、普通 member、跨组织 target、权限不足和 outbox/audit 原子回滚。
