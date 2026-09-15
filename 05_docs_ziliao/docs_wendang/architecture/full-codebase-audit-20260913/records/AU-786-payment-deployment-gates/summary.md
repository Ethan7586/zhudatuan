# AU-786｜支付 Jobs 与 Webhook 部署声明门禁

- 审阅范围：`check/payment-jobs-deployment.mjs`、`check/payment-webhook-deployment.mjs`，及其 payment runtime/entry/service/environment/delivery 输入。
- 审阅方式：深读 Jobs 专用 role/queue/ready 接线、Webhook 专用 operation/role/port/Caddy/migration checksum 接线；两个只读 checker 均已定向运行。

## 审计结论

- **G0：全部保留。** 这是支付 Jobs 和 payment webhook 独立运行单元的声明性 cross-file contract，覆盖角色、端口、环境变量、构建 entry、systemd/Caddy 与迁移 marker。
- **F-0305 / P2：** 两者均以精确源码片段断言而非语义/AST/行为契约。Jobs checker期待 literal `state.current_user !== 'shopjob'`，实际运行时等价地使用 `expectedRole = 'shopjob'`；Webhook checker期待三参数 `listen(...)`，实际已合法增加第四个 `nodeContextResolver`。固定基线因此无法完成后续部署声明验证，不能将失败读作支付部署未接线。
- 未运行 migration、systemd 或线上 webhook；本批只验证静态部署声明。
