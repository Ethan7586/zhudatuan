# AU-509｜金融动作凭证消费实现与测试

- 审阅范围：`01_core_hexin/services/commerce/src/foundation/security/ActionProof.test.ts`（60 行）及 `ActionProof.ts`（55 行）；定向追踪 AccessPipeline、CommerceRuntime、identity 签发端与所有 `consume_action_proof` 调用。
- 审阅方式：逐段人工阅读和静态调用检索；未执行 PostgreSQL transaction 或金融命令。

## 真实运行关系

step-up/identity 操作签发 action proof → 客户端以 `x-action-proof`、idempotency 和 expected version 调金融 operation → AccessPipeline 的 `PgActionProofVerifier` 仅校验证明字符串格式。独立的 `consumeActionProof` 会哈希 bearer，并将 actor/session/membership/scope/operation/resource/idempotency/version/request hash 传入 `access.consume_action_proof`；它的注释要求在命令 transaction client 内调用。

## 审计结论

- **F-0243（P1）的复核补强**：测试证明消费 helper 的 binding 参数、哈希和 malformed fail-fast 语义；但 `PgActionProofVerifier` 构造参数 pool 未被使用，`validate` 只调用本地正则；对 `consumeActionProof` 的生产源码检索仅命中定义本身，未见金融命令 transaction 消费点。签发/格式检查不等于一次性消费。
- `consumeActionProof` 和测试均为 **G0**：它们保存预期的数据库原子消费契约，不能因暂时无消费者而删除；删除会使后续正确修复失去唯一实现/规格。
- Owner transfer 的独立 HMAC proof 不属于此 DB action proof 机制，不可混同或据此推断金融证明已消费。

## 未验证项

- 未连接数据库，不能确认 `access.consume_action_proof` 的实际事务、锁/并发、过期与回滚语义。
- F-0243 已在独立复核队列中；复核必须从每个金融 command 到 transaction/DB routine 重新追踪，不能仅重读此 helper。
