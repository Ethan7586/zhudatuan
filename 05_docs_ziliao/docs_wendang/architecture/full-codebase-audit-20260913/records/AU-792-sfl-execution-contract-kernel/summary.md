# AU-792｜SFL 执行合同内核静态检查器

- 审阅范围：`check/sfl-execution-contract-kernel.mjs` 与 OpenAPI/operations/SDK/ExecutionKernel/ModuleOperations/OperationHandler/migration 输入。
- 审阅方式：深读 runtime/frozen critical write 分组、transaction/idempotency/state/outbox/business number/audit/schema/SDK/bypass/hash 九维断言；运行默认只读模式，未传 `--write`。

## 审计结论

- **G0：保留。** 它为 SFL 2.2 关键写操作建立跨契约、SDK、执行内核和数据库 migration 的静态 coverage matrix；与 AU-790 PG17 fixture 共同形成静态/数据库两层证据。
- **验证结果：** 345个操作定义、112个关键写、79个 runtime critical writes；所有 runtime 维度为 PASS，唯一 provider write 的 idempotency 为 N/A，33个 frozen writes 全维度 N/A。
- **边界：** `transaction_entry`对 transactional path 只检查共享 `ModuleOperations` 包含 kernel 调用，不能逐业务 handler 证明无旁路；默认模式也不校验已保存 evidence JSON是否最新，生产执行仍需 runtime/PG 证据。
