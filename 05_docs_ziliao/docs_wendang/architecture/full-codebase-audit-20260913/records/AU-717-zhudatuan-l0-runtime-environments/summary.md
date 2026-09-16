# AU-717｜Zhudatuan L0 运行环境模板

- 审阅范围：`02_platform_pingtai/infrastructure/zhudatuan/aliyun/` 下 20 份尚未审阅的 `.env.example`，及其 systemd、delivery、release 与客户端构建引用。
- 审阅方式：深入审阅每一类进程角色的差异键、privilege/token/port 绑定和模板消费者；共享 Node manifest、release pointer、TLS、secret-store 键作结构性审阅。

## 运行关系

- Identity、Web business、Purchase、Mall provisioning、Catalog、Payment webhook 为独立 API role/profile；Payment/Catalog/Identity notification 为独立 job role/profile。systemd 固定 profile、loopback port 和 EnvironmentFile 名称，模板仅提供可变连接/密钥引用。
- 注册、Owner、migration、DB role、sandbox 模板均为有确认词、sentinel、数据库名或独立 SQL guard 的一次性受控流程，不能按没有常驻进程引用删除。
- `sfl-identity-notification-jobs.env.example` 并非 L0 重复：与 L0 版本字段形状相同，但绑定 HBBTZN L1 的 connection ref、endpoint、manifest、release pointer 和 worker ID。
- Console 在构建时使用 API base URL；生产节点宣言与 UI 批准配置指向 `api.fufu.wang`，该 canonical API加载完整 Commerce module 集合（含 Support）。

## 审计结论

- **G0：19 份模板保留。** 各模板都承担 systemd/workflow/one-shot 的密钥最小化、数据库身份或节点绑定契约；同形字段不能据此推断重复无用。
- **G1：Console Support 专用模板/服务调用缺口。** `console-support.env.example` 支持专用 loopback `ConsoleSupportMain`；它仍在 release target、service unit 和健康检查中注册，但固定基线的 Caddy 没有 4324 reverse-proxy，Console 以 `apiBaseUrl` 调用 canonical API，未发现其它仓内 local caller。存在仓外本机调用、历史切换或运维用途的可能，故不可删除。
- 无新增 P0/P1/P2/P3 代码问题；未运行服务、构建或生产环境读取。

## 未验证项

- 未读取生产 `EnvironmentFile`、systemd active state、Caddy active configuration、secret-store 内容或实际请求 trace。
- 未验证 Console Support 是否由仓外本机代理、诊断流程或回滚路径调用；任何收窄前必须做独立只读复核。
