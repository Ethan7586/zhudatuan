# AU-769｜Identity Concurrency PG17 fixture

- 审阅范围：`identity-concurrency.pg17-fixture.mjs` 与 root `test:identity-concurrency` entry。
- 审阅方式：深入审阅随机资源、Docker lifecycle、fresh migration replay、database role password setup、Commerce test argv/environment 和 finally cleanup。
- 验证：未运行。该入口会创建 Docker PostgreSQL、回放迁移并写入隔离数据库，超出本阶段只读审计边界。

## 审计结论

- **G0：保留。** root script 正式注册该 fixture；每次随机 container/name/password、绑定 loopback random port，利用 `database-contracts --postgres-fresh` 取得 fresh schema 后向 `IdentityConcurrency.test.ts` 提供 admin/identity/app role DSN。
- **边界：** 验证可覆盖 PostgreSQL 17 角色与并发测试，但不证明线上 Docker/DB/network/provider 状态；cleanup 是 best-effort，异常时仍调用 `docker rm -f`，实际 container leak 需要运行 receipt 确认。
