# AU-541｜Commerce repository/job 集成测试入口

- 审阅范围：`01_core_hexin/services/commerce/vitest.integration.config.ts`（9 行）；定向清点 repository/job include 下的 test files 和 workspace script。
- 审阅方式：配置、测试入口与文件清单人工阅读；未执行测试。

## 真实运行关系

`npm run test:integration --workspace @shop/commerce` → integration Vitest config → `tests/repository/**/*.test.ts`（16 个 PostgreSQL/PGlite/repository contract files）及 `tests/job/**/*.test.ts`（2 个 job/import files）；每个 test 的实际 environment/endpoint guard 由其自身定义。

## 审计结论

- **G0**：repository persistence、finance/identity/mall provisioning 与 generic job/import 通过独立 node suite 被统一收集；此前已审的 AU-521 至 AU-536 皆由此入口覆盖。
- 该 config 只设 20 秒 test timeout，未声明并行/串行、数据库 bootstrap 或 environment gating；这些安全性由 individual test/harness 承担，不能从 config 推导实际 fixture 隔离。

## 未验证项

- 未执行集成 suite；未验证外部 PostgreSQL endpoint、每一 test 的 cleanup、并行锁竞争、20 秒对慢环境的稳定性，或 release control-plane 是否调用该入口。
