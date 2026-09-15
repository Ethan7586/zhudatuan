# RV-0014｜Vendor Endpoint 信任边界独立复核

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。从 channel create/update → signed extension install → vendor runtime client 出站请求重新取证；未读取连接、secret 或出口网络状态。

1. `CreateConnection.ts:14-80` 允许 critical channel connection 操作同时提交任意 configuration.baseUrl 和 secretRef；secret 只检查 JSON 值形状。
2. `InstallExtension.ts:24-88` 验证 Manifest 签名/contract，却对非 private provider 只要求 `baseUrl.startsWith('https://')`；没有与 manifest origin/allowlist 关联。
3. `Connection.ts:12-21` 也只强制 HTTPS；不拒绝 userinfo、loopback、私网或链路本地地址。`Client.ts:68-110` 以 `new URL(path, baseUrl)` 发出认证 headers、request/trace/idempotency 标识和业务正文。

**F-0096 确认 P1，高置信度。** 有此 critical 管理能力的主体可把 provider connection 和其认证/业务调用指向任意 HTTPS origin；Manifest 签名无法限制该网络目的地。未确认线上可利用主体、实际 secret ACL 或出口策略，故不是 P0。

修复必须从最新主线单独进行：在 provider manifest 或受管 policy 中声明批准 origin，并覆盖 userinfo、私网/loopback、IPv6、重定向、区域端点与既有连接兼容；不与 transport 容量或业务 provider 修改混批。
