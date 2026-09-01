# Cloudflare 边界说明

本目录不是生产运行时或发布 Authority。域名到客户端制品的唯一映射由
`infrastructure/network/Edge.yml` 定义。`fufu.wang` 由 Cloudflare DNS 与 Tunnel 接入生产
Nginx，静态客户端从 `/opt/smart-wiston/current` 的不可变发布目录提供，Commerce API 仅在
回环地址监听并由 `api.fufu.wang` 的专用虚拟主机代理。

Cloudflare 记录和 Tunnel 不得改变签名 releaseId、客户端制品 Hash 与服务器原子回滚指针。
专用 API 虚拟主机必须把 `routes.api.originHost` 传给 Commerce；不得把公开 API 子域名误作
商城租户域名。

- 禁止把 ECS 的 `.env.production`、Supabase service role 或 AI 密钥上传到 Cloudflare、Git 或前端包。
- DNS 记录变更后，应复测 `Edge.yml` 中全部 Web 域名、SPA 深链、`/health` 与回滚指针。
- 禁止启用 Worker、Wrangler、Caddy 或另一个客户端发布入口。
