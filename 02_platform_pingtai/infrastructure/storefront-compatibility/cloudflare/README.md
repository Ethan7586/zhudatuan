# Cloudflare 边界说明

Cloudflare 负责 `hbbtzn.com`、`www.hbbtzn.com` 与 `smart.hbbtzn.com` 的 DNS、TLS 边缘防护和代理。
生产运行时不部署独立 Cloudflare Worker；商城与运营后台均运行在阿里云 ECS，由 Caddy 反向代理。

- 禁止把 ECS 的 `.env.production`、Supabase service role 或 AI 密钥上传到 Cloudflare、Git 或前端包。
- DNS 记录变更后，应复测两个域名的 HTTPS、`/api/health` 与后台首页。
- 若未来启用 Worker，必须新增 `wrangler` 配置和独立部署流程，不可复用 ECS 的会话 Cookie。
