# RV-0007｜Console runtime 域名绑定独立复核

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。从 manifest → runtime parser/resolver → Console loader → SDK request 重新取证；未读取线上 runtime 文件或发起业务请求。

1. L0/L1 manifest 分别绑定 `console.fufu.wang`/`console.hbbtzn.com`，相应 Caddy 与 release target 各自读取正确 Console pointer，故正常生成路径的 host 是自洽的。
2. `SflNodeKernelConsole.ts:214-231,330-450` 对 `api_base_url` 仅要求完整 HTTPS origin、对 identity entry 仅要求 HTTPS 且无凭据/hash；`validateNodeRuntimeReferences` 只比较 build/digest/resource binding/scope，不将 URL host 比对为 Manifest API/identity domain binding。
3. `RuntimeConfig.ts:35-58` 解析后直接安装该 runtime；SDK 以 apiBaseUrl 构造请求，并会携带 scope、版本、idempotency、CSRF 和 action-proof headers。AutoNode 当前 producer 从同一 request.domains 生成 URL/manifest，是缓解事实，不是消费者不变量。

**F-0029 确认 P1，高置信度。** 合法 Manifest、合法 digest/ref/scope 的 runtime 文件仍可携带任意 HTTPS API/Identity host，Console 将把认证跳转与敏感业务请求导向该地址。未证明线上 runtime 已被篡改或有实际泄露，故不是 P0。

后续修复必须在最新主线单独实施：由 binding ref 派生 URL 或做 exact host/surface 校验，并覆盖 L0/L1、错误外域、旧 schema 与真实 CORS/redirect 边界；不与 Caddy、业务 API 或发布改动混批。
