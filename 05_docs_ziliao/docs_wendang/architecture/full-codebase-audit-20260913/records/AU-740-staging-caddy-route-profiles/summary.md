# AU-740｜Staging Caddy 路由配置族

- 审阅范围：普通 staging `Caddyfile`、`Caddyfile.full`、`Caddyfile.identity-sms` 与 full systemd drop-in。
- 审阅方式：深入审阅 full profile 公开 host、identity method/path allowlist、loopback 4431、fallback 404和drop-in；普通/identity-sms profile作结构性差异审阅。未执行 caddy validate/reload，未读取实际配置。

## 审计结论

- **G0：全部保留。** `Caddyfile.full` 与 drop-in被 candidate installer、artifacts/readiness runtime明确消费；普通 Caddyfile为普通 staging delivery 的 proxyConfig；identity-sms 是相同公开 route contract但定向到 profile 的 loopback 4421。
- full profile不代理任意 `/api`：仅 allowlisted identity methods/routes及 health 转发到 `127.0.0.1:4431`，其他请求返回 404；accounts/console 静态站点也显式拒绝 `/api/*`。这降低 staging 路由误暴露，但实际 hostname/DNS/active Caddy syntax和服务状态未验证。
- `caddy-zhudatuan-staging-full.conf` 只注入 full-caddy env，不改变 distro ExecStart/reload；不可按只有五行而删除。
