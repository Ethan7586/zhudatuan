# AU-762｜MVP Kernel 集成夹具

- 审阅范围：`04_tools/scripts/audit/mvp-kernel.mjs` 及其 `database-contracts.mjs --mvp-kernel` 调用入口。
- 审阅方式：深入审阅 seed、container bindings、cart/quote/order/payment 调用、PGlite role wrapper、outbox/job runner/reconciliation、DB evidence assertions 和 payment/KMS test boundary。未运行。
- 验证：正式入口是 `npm run test:mvp`；本工作树已在 AU-756 证明缺少可解析 internal workspace package link，且该命令会建立隔离 PGlite 数据状态，因此本 AU 保留为未运行的源码证据。

## 审计结论

- **G0：保留。** fixture 经 `test:mvp` 进入，seed 一个 Mall/member/catalog/price/stock/experience/address 的隔离场景，直接调用 cart、checkout、order、payment operation，检查 role-bound scope、转换状态、金额、reservation、tender、outbox、audit 和 idempotency，再手工运行 payment/reconciliation worker path。
- **测试边界明确：** HTTP router/controller/session/CSRF/Origin 不在链路中；KMS decrypt、微信支付预支付/验签/退款均为内存 fixture；PGlite 不能代替 PostgreSQL 的锁、RLS/planner、网络及真实 provider 行为。通过只证明 selected application/DB contract 集成，不证明完整线上主路径。
