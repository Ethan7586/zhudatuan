# AU-601｜平台 Owner 交接迁移

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260829211000_platform_owner_transfer.sql`（1,843 行）。
- 审阅方式：分段逐行人工审阅 ownership contract、singleton/transfer/action-proof schema、会话/assurance 边界、密码与手机号受控变更、transfer create/accept/cancel/expire、bootstrap state、registration write protection、生命周期与 deferred singleton trigger；交叉检查 AccessOperations/AccessPort、CredentialOperations、MobileWechatOperations、seed/verification 和 migration plan。未连接数据库、未执行 transfer 或凭据变更。

## 审计结论

- **G0：保留。** 此 migration 是主打团平台 Owner 唯一交接与单例保护基础，承载 owner bootstrap、密码/手机号变更、继任候选、交接证据、会话撤销与注册写边界；不得因其高复杂度或部分函数无普通 HTTP import 而删除。
- [FACT][E-AU-601-001] `access.platformowner` 是 singleton state，`ownertransfer` 强制唯一 pending transfer、24 小时冷静期与 7 天过期，`owneractionproof` 绑定 actor/session/source/target/version/reason hash 且一次消费；权限、operation、event、capability 与 entitlement 同步注册。
- [FACT][E-AU-601-002] create/commit/cancel 均要求 serializable transaction、`shopapp` API workload、actor/membership/session 一致、advisory lock、version/action proof；创建方需近期 AAL3，继任人需 active operator、手机号、self role/scope、有效管理角色且无关键 deny；创建后加临时 successor role、提高 access version、撤销 target sessions。
- [FACT][E-AU-601-003] commit 受 24 小时冷静期、7 天失效、source/target version 和 proof 约束；platform owner singleton、role/self role、platform/tenant/self scope 与无 override 由八类 deferred constraint trigger 反复校验，防止单一拥有者、角色或 scope 被静默破坏。
- [FACT][E-AU-601-004] Owner 密码/手机号变更走受控 security-definer function：身份/会话/assurance/证据与 lock 全部重新核验，更新后递增 version 并撤销 active sessions；直接 identity write 保持由 owner trigger 和 registration boundary 拦截。`CredentialOperations`、`MobileWechatOperations`、`AccessOperations/AccessPort` 是仓内调用者。
- [FACT][E-AU-601-005] bootstrap state 与 registration guard 只允许固定独立 registration database、专用 role、sentinel/identity subject HMAC/刚消费 challenge 的契约路径；final assert 覆盖 operation count、mobile boundary、scope resolver 与九个 owner protective trigger。

## 未验证项

- 未执行 bootstrap、正常交接、冷静期/过期/取消、并发 transfer、action proof 重放、继任人 deny overlay、session revocation、密码/手机号变更或 RLS allow/deny。
- 未验证真实平台是否存在唯一有效 Owner、真实 owner 手机/step-up/secret 存放、历史固定 owner tombstone 或线上恢复/回滚流程；这些不能据此写成已部署事实。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；任何 Owner 交接改动必须由身份、权限与数据库专项在隔离 PostgreSQL 覆盖完整 happy path、拒绝路径、并发串行化、过期、重放、拒绝覆盖、所有会话撤销和失败回滚。
