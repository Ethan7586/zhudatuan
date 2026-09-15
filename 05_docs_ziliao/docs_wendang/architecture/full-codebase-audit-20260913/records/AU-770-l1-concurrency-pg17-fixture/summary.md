# AU-770｜L1 并发 PG17 fixture 包装器

- 审阅范围：`l1-hongtai-concurrency.pg17-fixture.mjs`，与 AU-756 的 runner/plan/report 关系。
- 审阅方式：深入审阅 Docker lifecycle、fresh replay、六个 role password/DSN、runner 环境传递与 cleanup；runner 的业务链路不重复审阅。
- 验证：未运行。会启动 Docker、回放迁移、执行 1/10/100 并发并覆盖历史 machine evidence。

## 审计结论

- **G0：保留。** L1 计划和历史报告显式指定该文件为复验入口；它创建隔离 PostgreSQL 17，完成 fresh contract replay，为 Identity API/Jobs、Web、Purchase、App、Job 角色提供独立 loopback DSN，再运行 AU-756 已审的真实 HTTP/DB/queue runner。
- 运行会重写 `l1-hongtai-concurrency-latest.json`，因此本审计分支不执行。历史 2026-09-09 evidence 只说明当时隔离运行，不是本次当前结果。
