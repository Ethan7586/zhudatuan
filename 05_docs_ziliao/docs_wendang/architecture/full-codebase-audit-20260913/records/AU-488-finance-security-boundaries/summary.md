# AU-488｜财务安全边界迁移深审

- 审阅对象：`02_platform_pingtai/database/supabase/migrations/20260828092000_finance_security_boundaries.sql`（505 行）。
- 方法：人工逐段审阅 action proof、会话 assurance、资源范围解析、账本/事件不可变性、RLS/grant 和契约发布；静态追溯 Identity step-up、AccessPipeline、ActionProof、Finance/Invoice 运行入口。未执行迁移、数据库、Worker 或线上只读检查。

## 真实运行关系

`identity.stepup.complete` 在当前 session 写 level-3 assurance 并通过 `access.issue_action_proof` 返回一次 bearer proof；请求随后经过 `AccessPipeline.authorize`。迁移设计的消费端是 `access.consume_action_proof`，并以 actor/session/membership/scope/operation/resource/idempotency/expectedVersion/requestHash、未消费状态和有效期原子绑定；`finance.assert_expected_version` 设计为在命令事务中锁定资源。

迁移还禁止直接改写 Finance 账本，限制 statement/period 的窄列更新，为 invoice 采用 owner-derived RLS，并让 Finance/Invoice/订单/支付事件在 outbox/inbox 中保留不可变事实。`app/jobs.ts` 注册 Finance Worker；Finance 读操作以 `access.scope_allowed` 和组织闭包筛选。

## 评审结论

- **F-0243 / P1 候选**：目前运行源码仅以 `PgActionProofVerifier.validate` 检查 bearer 的字符串格式；全仓运行源码与后续迁移中未找到对 `access.consume_action_proof` 或 `finance.assert_expected_version` 的实际调用，只有定义、grant 和针对 helper 的单元测试。因此已签发 proof 的单次消费、请求绑定和数据库内 optimistic-lock 保障未接入命令执行链。具体生产可达性和影响范围未验证，必须独立复核。
- **GX-0012（扩展）**：该迁移仍承担财务/发票权限、资金事实保留和数据库 RLS 边界，禁止删除、单独重放或与功能改动混合。
- 未发现 P0。迁移所宣称的数据库安全边界不等于已在每个实际运行数据库执行；ledger、RLS 生效状态及 service-role 调用路径未验证。

## 建议与验证边界

后续仅可在当时最新主线的独立修复分支中：将 proof 的消费与 expected-version 锁定纳入每条高风险命令的同一数据库事务，并用隔离 PostgreSQL 覆盖有效/伪造/过期/重复 proof、不同 session/resource/request、权限变更、版本冲突和回滚。先由第二位审计者重新追踪 API→命令→SQL transaction、目标数据库函数定义/grant/RLS、正式迁移 ledger 和 service-role 调用者；本审计分支不实施。
