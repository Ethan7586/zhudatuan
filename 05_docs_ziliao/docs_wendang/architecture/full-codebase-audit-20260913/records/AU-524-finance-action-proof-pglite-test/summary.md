# AU-524｜Finance action proof PostgreSQL/PGlite 边界测试

- 审阅范围：`01_core_hexin/services/commerce/tests/repository/FinanceActionProof.test.ts`（273 行）；定向复核 finance security migration 的 proof/expected-version 函数及 F-0243 运行调用链。
- 审阅方式：逐段人工阅读；PGlite migration replay 未在本轮执行。

## 真实运行关系

测试以 PGlite 重放至 finance security migration，建立 account/session/assurance/capability 状态；DB functions 签发 proof 并将 token、actor/session/membership、scope、operation、resource、idempotency、version/request hash 原子绑定。消费在同一 DB transaction 内可回滚，并在 credential、principal、membership、capability/permission 变化后拒绝。测试还覆盖 invoice immutable profile RLS 和 financial inbox/outbox retention。

## 审计结论

- **G0 / F-0243 补强**：此测试实际验证数据库 proof mechanism 可绑定、单次消费、事务回滚和持续授权重验；它是唯一的高价值 DB 行为规格，不能删除。
- 测试直接调用 `issue_action_proof`/`consume_action_proof`，而应用运行链仍未将 `consumeActionProof` 编排进金融命令 transaction。故该测试不能证明生产 HTTP command 已防重放，反而清晰界定 F-0243 的 integration gap。
- PGlite replay 截止 migration 有明确上限，不能代表完整最新数据库、PostgreSQL role/RLS 或 deployment state。

## 未验证项

- 本轮没有运行 PGlite；并发消费锁定、实际 service role/grant、所有 Finance/Invoice command 和 production migration ledger 仍待 F-0243 独立复核。
