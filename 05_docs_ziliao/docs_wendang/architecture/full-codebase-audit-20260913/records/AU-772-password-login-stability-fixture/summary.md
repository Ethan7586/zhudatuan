# AU-772｜Password Login Stability PG17 fixture

- 审阅范围：`password-login-stability.pg17-fixture.mjs` 与 root test entry。
- 审阅方式：与 AU-769/AU-771 同构，结构性审阅随机 Docker lifecycle、fresh replay、测试 role、round environment 和 cleanup；专项密码集成 test 本体留在对应测试模块。
- 验证：未运行。会启动 disposable PostgreSQL、回放 schema 并执行 Commerce integration test。

## 审计结论

- **G0：保留。** `npm run test:password-login-stability` 正式注册；fixture 为 `PasswordLoginStability.test.ts` 提供 admin/identity role DSN 和可配置 `SHOP_TEST_STABILITY_ROUNDS`。`zhudatuanroot` superuser 变更只作用于随机容器。
- 默认只运行一轮；稳定性强度由 caller 的 rounds 环境值决定，历史/当前实际轮数需要测试 receipt 核验，不能从该 wrapper 推断。
