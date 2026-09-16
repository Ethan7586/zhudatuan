# AU-667｜Cross-Realm Login Intents

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260908012000_create_sfl_login_intents.sql`（174 行）。
- 审阅方式：逐段人工审阅 login intent schema、issue/consume function、privilege、operation catalog 与断言；反向检查 Identity API handler、ticket/session creation flow、contract/SDK publication和现有测试。未执行数据库函数或 HTTP 流程。

## 审计结论

- **G0：保留。** login intent 为已认证源 Realm 到不同目标 Realm 的一次性、五分钟跨节点登录交接；source/target account、session、Realm 和 target 均受复合外键、有效期和原子 consumed state 约束。
- [FACT][E-AU-667-001] `issue_login_intent` 从仍有效的 source session 计算 target Realm/account host/target/return origin，而非接受客户端传入 host/origin；`consume_login_intent` 只接受同 target Realm/target/application 的有效 target session，并以单条 update 完成一次性消费。
- [FACT][E-AU-667-002] HTTP handler 要求已经认证的 source node context、拒绝同节点 target、随机生成仅保存 hash 的 token；随后目标 Realm 的会话创建路径绑定 target account/session 才能消费 intent。
- **F-0275（P3，新增）**：跨 Realm 交接的数据库安全契约没有实际数据库测试。现有 `LoginIntentOperations.test.ts` 只 mock `identity.issue_login_intent` 的返回值，验证 URL 和参数；仓内 Supabase SQL tests 对 `identity.issue_login_intent`/`identity.consume_login_intent` 无执行覆盖。因此复合外键、五分钟到期、source/target session mismatch、重复消费和未授权 DB role 的拒绝行为没有被可执行测试锁定。

## 未验证项

- 未执行 issue/consume function，未验证 RLS、SECURITY DEFINER owner 与 `shopapp`/Identity API privilege 的实际行为。
- 未验证 source/target Realm 分别登录、意图重放、目标 application mismatch和 source session撤销后的端到端 HTTP 结果。

## 结论等级

- 新增问题：P3 1 项（F-0275）。无 P0。
- 垃圾代码：G0 1 项（cross-Realm login intent schema/operation）；不新增 G1/G2/G3/GX。
- 二次复核：否。
