# AU-510｜ActionProof 实现与调用可达性

- 审阅范围：`01_core_hexin/services/commerce/src/foundation/security/ActionProof.ts`（55 行）；基于 AU-509 的逐段阅读，额外定向检索 Commerce runtime 注入与 `consumeActionProof` 生产调用点。
- 审阅方式：人工代码复核、静态引用检索；未执行数据库 transaction。

## 审计结论

- `actionProofWellFormed` 只定义长度/字符集语法；`PgActionProofVerifier.validate` 只调用该函数，其构造参数 pool 没有参与验证。CommerceRuntime 将它注入 AccessPipeline，故线上授权门只获得格式判断。
- `consumeActionProof` 则正确建模 token SHA-256 与全部业务 binding 的数据库调用，并要求 command transaction client；全仓生产检索无该 helper 的调用者，仅测试调用。
- 结论与 **F-0243（P1 候选）**一致：此文件既保存修复需要的原子消费实现，也是当前绕过消费的直接证据。分类 **G0**，禁止删除；独立复核仍待完成。

## 未验证项

- 未验证 DB 函数实际 grant、RLS、锁/重放/失败回滚；不得据此宣称 proof 消费在生产中工作或不工作以外的具体运行结果。
