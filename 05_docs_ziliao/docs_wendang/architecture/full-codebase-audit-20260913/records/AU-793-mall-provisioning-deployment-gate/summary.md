# AU-793｜Mall provisioning 部署声明门禁

- 审阅范围：`check/mall-provisioning-deployment.mjs` 与 provisioning runtime/module/operations/environment/systemd/Caddy/delivery/migration/role/object-contract 输入。
- 审阅方式：深读专用 operation/profile/role/port/allowed origin/migration checksum/registration runner/object policy 断言；运行只读静态入口。

## 审计结论

- **G0：保留。** 该 checker 是 Mall provisioning 独立运行单元跨源声明的回归门禁。
- **F-0307 / P2：** 它期待历史三参数 listen 文字；当前 `MallProvisioningApiMain` 保留同一 app/port/loopback 并合法新增 `bootstrapped.nodeContextResolver` 第四参数，导致首个 token 检查失败，后续 role/systemd/Caddy/migration 验证都不执行。
- **限制：** 本批没有执行 provisioning、迁移、role provisioner 或服务启动；静态失败不能证明实际 Mall 创建、权限或路由故障。
