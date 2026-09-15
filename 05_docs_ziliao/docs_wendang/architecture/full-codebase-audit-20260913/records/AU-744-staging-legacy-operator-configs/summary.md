# AU-744｜Staging 旧操作配置与 Full profile 文档边界

- 审阅范围：staging `README.md`、`PREPARE.md`、基础设施规格、legacy `delivery.yml` 和三个 PM2 ecosystem 配置。
- 审阅方式：以操作文档命令和 `check.mjs` 的实际 legacy 配置消费为入口；将同构 PM2 配置做代表性结构审阅，并与 full profile 的 systemd-only 契约和 P00–P12 门禁交叉核对。未执行 PM2、Caddy 或任何主机/云操作。

## 审计结论

- **G0：legacy `delivery.yml`、default/identity-SMS PM2 config 不能按零引用删除。** `check.mjs` 明确加载 default PM2 config 与 delivery 文件；identity-SMS profile 提供隔离 API/OTP Jobs 配置。`ecosystem.full.config.cjs` 则主动抛错，阻止把 Full staging 误交给 PM2。
- Full staging 的 `PREPARE.md` 与 infrastructure spec 明确固定候选 ECS、生产隔离、逐 gate 授权、systemd-only unit、Full Jobs fail-closed，且不将成本批准扩大为部署/写入授权。这是当前 full profile 的较强安全边界。
- **发现 F-0295（P2）：** 默认 README 未标明它是 legacy/非 full runbook，仍指向 `/opt/zhudatuan-staging` 并指导直接 Caddy reload、PM2 启动；它与同目录 full 门禁产生可操作的双控制面。保留 legacy 配置，后续应收敛入口和标识，不在审计分支改动。
