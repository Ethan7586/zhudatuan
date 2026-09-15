# AU-778｜Jobs callgraph 静态门禁

- 审阅范围：`audit/jobs.mjs` 与 `check/callgraph/jobs.mjs`。
- 审阅方式：深入审阅 TypeScript program input、registry traversal、required fields、worker target check、report callers和 root entry。

## 审计结论

- **G0：两文件均保留。** `check:jobs`/architecture/runtime/calls gate 以 AST 从 `services/commerce/src/app/jobs.ts` 抽取 registrations，要求 owner/queue/concurrency/timeout/retry/lease/idempotency/deadLetter/runbook/worker，且 worker 可静态定位。
- **边界：** 不加载 worker，不连接 queue，不验证 schedule、retry、dead letter、lease、idempotency 或运行时注册；通过仅证明 registry 声明形状和静态 target 可见。
