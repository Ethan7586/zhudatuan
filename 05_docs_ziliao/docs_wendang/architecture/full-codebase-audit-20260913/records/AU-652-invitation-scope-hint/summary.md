# AU-652｜Honor Invitation Scope Hint

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260905012000_honor_invitation_scope_hint.sql`（69 行）。
- 审阅方式：逐段人工审阅 `resolve_scope` 对 role/scope/invoice/invitation 的 resource 与 hint precedence；交叉检查 session-bound resolver、AccessPipeline 的 permission/capability 消费次序和 identity invitation operation。未执行数据库。

## 审计结论

- **G0：保留。** migration 为尚无 resource 的 `identity.invitations.create` 明确将 non-null scope hint 规范化为 scope object；role 与 invoice operations 优先采用已存在资源的 owner scope，避免 hint 改写既有对象归属。
- [FACT][E-AU-652-001] 之后的 `access.resolve_session_scope` 仅在 session membership 的 realm/client/organization context 精确匹配时才调用本 resolver；AccessPipeline 随后执行 membership permission、scope decision、governance 与 capability 检查，hint 不单独构成授权。
- [FACT][E-AU-652-002] identity invitation create 的 operation 与 capability 在 Identity runtime 的已注册模块中存在，scope hint 由标准 `x-scope-hint` 接收并受非空/长度上限验证。
- [FACT][E-AU-652-003] migration 使用精确 predecessor、受限 migration context、ledger marker与 function-text assertion；RegistrationMigrationPlan 保存其 source digest 的 legacy ledger compatibility。

## 未验证项

- 未在真实数据库运行 create invitation 的 valid/invalid/cross-scope hint 矩阵，也未发起 HTTP 请求。
- 未核验仓外客户端是否对该 header 作出兼容承诺；本仓只确认服务端 scope resolution 数据流。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：否。
