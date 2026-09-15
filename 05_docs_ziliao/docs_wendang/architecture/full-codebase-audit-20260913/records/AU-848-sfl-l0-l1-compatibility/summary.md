# AU-848｜SFL L0/L1 兼容边界清单

## 覆盖与方法

深入审阅 `architecture/09-SFL-L0-L1兼容边界清单.md`（63 行），核对 COMPAT 分类、生产/候选边界、退出判据以及相关 Worker 的静态路由配置。未读取生产控制面、未连接 Tunnel、未执行发布或网络操作。

## 证据边界

文档冻结于 2026-09-08，明确候选完成不能替代生产退出。当前 `hbbtzn-alias` 源码仍声明无 upstream/proxy/public route，配置的 `routes` 为空，代码返回 410；这只能支持候选静态边界。文档所称生产切流、独立进程、Tunnel、支付与关闭式失败尚需独立运行证据；其列出的 `production-domain-boundary.json` 路径也不再存在。

## 结论

- 保留为 G1/DC-0111；SFL 1.6 被写作适用标准的权威冲突已并入 F-0324，不重复立项。
- 未新增 P0—P3：文档本身没有将候选静态状态伪装成已完成生产退出。
- 未修改 Cloudflare、Tunnel、身份、支付、部署或任何线上资源。
