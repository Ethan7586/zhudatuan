# AU-771｜Mall Provisioning PG17 fixture

- 审阅范围：`mall-provisioning-engine.pg17-fixture.mjs` 与 root test entry。
- 审阅方式：深入审阅 Docker lifecycle、fresh replay、provisioning API role、Commerce integration argv/DSN 与 cleanup；生产 systemd/release relationship只作入口对照。
- 验证：未运行。会创建 PostgreSQL 17 容器、回放 schema 并写入隔离 fixture 数据。

## 审计结论

- **G0：保留。** `npm run test:mall-provisioning:postgres` 注册此文件；它以 disposable Docker PostgreSQL 17 执行 complete replay，配置 `zhudatuanprovisioningapi`，运行 `MallProvisioningEngine.test.ts`。
- runtime 部署由 L0 systemd/remote-policy/release target 管理，与测试 DB fixture 不共享 DSN、节点指针或线上进程。测试通过不能代替生产 Mall provisioning 的 host/network/env 验证。
