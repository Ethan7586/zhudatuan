# AU-739｜Full Staging systemd 工作负载

- 审阅范围：full database retire、identity API、identity notification jobs、migration、owner bootstrap、RDS init 六个待审 systemd unit。
- 审阅方式：深入审阅 one-shot 顺序、EnvironmentFile/credential、condition gate、loopback、DynamicUser 和 sandbox；对 identity jobs 的同构 sandbox 作结构性审阅。未访问 staging host、未启动/enable unit。

## 审计结论

- **G0：全部保留。** `artifacts.yml`、readiness-systemd/toolchain/runtime 明确登记这六个 unit；RDS init → migration → owner bootstrap → database retire → identity API/jobs 的文件存在性与反向 ConditionPathExists 形成启动/退役闸门。
- Identity API 仅 loopback `4431`、DynamicUser、strict systemd sandbox；RDS init/retire 使用 root 写入的临时 env 后以动态用户和 loopback proxy执行。实际 host file permissions、systemd state、数据库目标和服务健康均未验证。
- Full Jobs 的 `ExecCondition=/usr/bin/false` 是有意 fail-closed：PREPARE 文档说明 provider sandbox preflight 尚不具备，readiness 也将其不可用视为未满足条件；不是待清理的死代码或本 AU 的修复对象。
