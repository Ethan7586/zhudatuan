# Cloudflare 边缘实现运行手册

本文只记录当前供应商实现。Host、Surface、商城域名、缓存、CSP、CORS 与速率策略的唯一事实源是 `infrastructure/network/Edge.yml`、`infrastructure/storage/Cors.yml`；Cloudflare 配置不得创造业务路由或覆盖签名制品身份。

## 变更前

Owner 为 Platform，复核人为 Security。变更单必须记录 releaseId、Edge 配置 Hash、DNS 差异、证书序列、源站 mTLS 身份、回滚版本和维护窗口。先确认六端静态制品及 API 源站健康，并导出当前 DNS、WAF、缓存规则和 Tunnel 路由作为不可变证据。任何 Secret、Cookie、Authorization、Service Role 或私钥不得进入变更单、Cloudflare Worker 或页面规则。

## DNS、证书与回源

只创建 `Edge.yml` 声明的七个业务 Host 及上传、下载 Host。代理记录指向受管入口，不直接暴露节点地址；TTL 在切换前一个周期降至 60 秒，稳定后恢复。边缘证书最低 TLS 1.3、开启 HSTS，源站只接受 mTLS 和已知 Host。证书剩余 30 天告警，更新后逐 Host 校验 SAN、OCSP/CRL、证书链和源站身份。API Host 不参与商城域名解析，未知或重复 Mall Host 必须返回 404。

## 缓存与发布

只有带 releaseId 和内容 Hash 的静态路径可长期缓存；`releases/current.json`、API、签名下载和用户内容均 `no-store`。发布控制器先上传六端不可变目录并核对 Hash，再原子更新 pointer；禁止在边缘改写 JavaScript、HTML 或响应数据。商城域名切换后验证首页、SPA 深链、支付回跳、上传、下载、CSP 报告和 `/health`。

## 故障与回滚

WAF 误拦截时只回滚本次规则版本，不关闭全局防护。缓存污染时按 releaseId 精确清理并回退 pointer；DNS 或 Tunnel 故障时恢复变更前导出，不创建旁路源站。回滚后执行六端 Smoke、Mall Host 解析、API Origin、证书和缓存键核对，并把请求编号、时间线、影响商城、恢复版本和证据 Hash 写入事件记录。已完成的支付、核销、退款和账务事实不随边缘回滚。
