# AU-662｜Identity Lifecycle Realm Scope

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260907121000_scope_identity_lifecycle_by_realm.sql`（330 行）。
- 审阅方式：逐段人工审阅 mobile、challenge、assurance、login attempt、federated identity 的 Realm 转换及 owner credential/mobile 修改函数；反向检查当前 challenge 消费、SMS 登录、密码重置与 account-bound assurance 写入。未执行数据库或 HTTP 验证。

## 审计结论

- **G0：保留。** migration 将可恢复的登录生命周期状态从 legacy principal 归属迁移至 `(realm_id, account_id)`，是 AU-661 的 Realm/Account schema 进入实际身份运行时的必要延续。
- [FACT][E-AU-662-001] Account mobile 的唯一性改为 `realm_id + mobile_token`，`identity.realmtarget` 取消全局 target 唯一性；允许相同目标名在不同 Realm 存在，同时保留 Realm 内的 mobile collision 防线。
- [FACT][E-AU-662-002] challenge、assurance、login attempt 和 federated identity 均增加 Realm/Account 定位；无法从 legacy principal 唯一确定 Realm 的历史 challenge/assurance 保持未绑定，而当前所有 registration、password-reset、phone-change、step-up 和 SMS-login 消费链均传入 Realm，未绑定旧记录不能被该运行时复用。
- [FACT][E-AU-662-003] platform owner 的 password/mobile 变更函数锁定 active membership、account、credential 与 session/assurance，变更后递增 account credential version、撤销对应 Realm sessions，并写入 owner mobile session-revoked outbox 事件。
- [FACT][E-AU-662-004] 迁移末尾断言复核 mobile pair 和所有已绑定 lifecycle record 的 Realm 完整性；当前 TypeScript challenge consumer 还同时要求 challenge 的 Realm 与 account 精确相符。

## 未验证项

- 未运行历史多 Realm principal 数据集，故未验证未绑定 legacy challenge/assurance 的实际数量与到期清理策略。
- 未以数据库角色调用 owner password/mobile function，未验证 RLS、session setting 与 outbox dispatcher 的端到端行为。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（Identity lifecycle 的 Realm scope migration）；不新增 G1/G2/G3/GX。
- 二次复核：否。
