# AU-745｜Full staging 主机与运行时 live validation

- 审阅范围：host/runtime readiness probes、环境契约 validator 与成本批准模板。
- 审阅方式：深入审阅主机 secret/DSN/phase、systemd/Caddy/listener/DNS/HTTP/ACL 实际断言；环境 validator 和批准模板按其与前述 access/env/成本验证器的契约做结构性审阅。未读取 `/opt` 主机文件、未访问 DNS/HTTP/阿里云/RDS，也未提交批准。

## 审计结论

- **G0：host validator 将 bootstrap/runtime 分开。** 它用模板 key 集、脱敏 access policy、唯一 bearer token、root 0600 文件、loopback TLS proxy DSN、RDS/Tair/SMS endpoint fingerprint 验证真实主机；runtime 还要求所有 one-shot 环境/密码文件已删除。
- **G0：runtime validator 是多层 fail-closed。** 它验证 current candidate、九个 unit 的安装来源、active/inactive 状态、五个 loopback listener、Caddy source/drop-in/env/ownership、三 host 的同一非生产 DNS IPv4、TLS health 和 API 404 负向路由。任何 probe 失败均作为 gate 缺项退出。
- Full Jobs 被显式要求 `inactive/dead/static`，不因缺 provider sandbox preflight 而被启动。环境 validator 还检查 workload grant 与 secrets catalog 的双向集合、token 唯一性及对象存储 token 隔离。
- 成本批准模板只含待填占位符和 Ethan 批准字段；其真实性必须由已审阅的 cost validator 对原始只读报价/规格/批准回执另行验证。所有实际主机、云和 provider 证据仍未验证。
