# AU-663｜Identity Session / Ticket Realm Binding

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260907122000_bind_sessions_tickets_to_realm_accounts.sql`（139 行）。
- 审阅方式：逐段人工审阅 session/ticket 回填、撤销、复合外键、session resolver 与断言；反向检查当前 session 创建、ticket 签发/交换、Realm account 查询及后续 target canonicalization。未执行数据库或真实票据交换。

## 审计结论

- **G0：保留。** migration 将活跃 session 与 authorization ticket 绑定到 Account、Realm、membership 和 target，消除仅按 legacy principal/session 的跨域歧义。
- [FACT][E-AU-663-001] 回填从 membership 推导 session 的 Realm/Account，优先采用该 session 最新 ticket 的有效 Realm target；没有完整 Realm/Account/target 分类的旧 session 一律 revoked，关联且不完整的未消费 ticket 一律 consumed。
- [FACT][E-AU-663-002] 复合外键将 session 同时约束到 `identity.account(id,realm_id)`、`access.membership(id,account_id,realm_id)` 和 `identity.realmtarget(realm_id,target)`；ticket 又必须引用相同的 session/account/Realm 和 target。
- [FACT][E-AU-663-003] 当前 `PgAuthTicket.consume()` 同时验证 entry Realm 可见性、ticket 与 session 的 Realm/Account/target 一致性、token/state/nonce/PKCE、有效期和 session 未撤销；签发与消费链均不能只凭 ticket id 跨 Realm 复用。
- [FACT][E-AU-663-004] 当前 resolver 以 entry host、account、membership、target 和 Realm-bound assurance 联结 session；后续迁移将专用 L1 target 归一为通用 target 名称，应用 `AuthTarget` union 的现状与最终 schema 语义一致。AU-660 的 F-0274 在审到该后续迁移时需要重新判定，不能仅以中间 migration 状态作为当前缺陷。

## 未验证项

- 未在历史数据库复放含多个未消费 ticket 的单 session 样本；无法量化 migration 选择最新有效 target、并消费不完整 ticket 的实际影响。
- 未执行 ticket issue/exchange HTTP 流程；静态检查未覆盖 signer 的密钥和回调 origin 运行配置。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（session/ticket Realm binding migration）；不新增 G1/G2/G3/GX。
- 二次复核：否。
