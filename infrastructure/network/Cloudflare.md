# Cloudflare 边界说明

本目录不是生产运行时或发布 Authority。域名到客户端制品的唯一映射由
`infrastructure/network/Edge.yml` 定义；当前静态客户端发布到阿里云 OSS/CDN，Commerce
运行在 ACK，经 ALB 暴露。不得用本目录重新引入 ECS、Caddy 或 Cloudflare Worker 运行时。

如 DNS 仍托管在 Cloudflare，只允许把记录指向已批准的阿里云边缘入口；DNS 记录不得改变
签名 releaseId、客户端制品 Hash、WAF/CDN 切换和回滚的阿里云发布真值。

- 禁止把 ECS 的 `.env.production`、Supabase service role 或 AI 密钥上传到 Cloudflare、Git 或前端包。
- DNS 记录变更后，应复测 `Edge.yml` 中全部 Web 域名、SPA 深链、`/health` 与回滚指针。
- 禁止启用 Worker、Wrangler、Caddy 或另一个客户端发布入口。
