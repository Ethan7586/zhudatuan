# AU-556｜hbbtzn L1 storefront 环境模板

- 审阅范围：`02_platform_pingtai/config/node-runtime/hbbtzn-l1/storefront.env.example`（7 行）；定向阅读 storefront identity/auth resolver、L1 remote target 与 deployment port。
- 审阅方式：环境键、浏览器运行时解析和发布入口人工追踪；未构建/打开页面或读取线上浏览器流量。

## 真实运行关系

storefront env → `sfl-storefront@hbbtzn-l1.service` on 4410 → deployed storefront-web dist → browser host registry → node-specific API/auth origin + consumer application. Remote policy delivers Storefront dist/dependency layer to the L1 target and health-checks hbbtzn host on port 4410.

## 审计结论

- **G0**：`api.hbbtzn.com`、`accounts.hbbtzn.com`、`hbbtzn.com` 与 `zdt-l1-verify` 对应 L1 manifest/registry 和 storefront source/test fixtures；deployment/remote policy 都以 hbbtzn L1 storefront target 与 unit 为准。
- `resolveStorefrontApplication` 将显式环境 application 与 host-resolved registry application 比较，不匹配即拒绝；生产 auth origin 也最终以 registry node accounts origin 为准，降低错误 `NEXT_PUBLIC_*` 值直接改变身份边界的风险。
- 该 env 无 secret/DB/worker keys；`NEXT_PUBLIC_CLIENT_VERSION` 仍是 release SHA placeholder，需发布时注入。

## 未验证项

- 未验证 build-time public env 注入、真实 Vite/Next server rendering、API/CORS、auth redirect、DNS/TLS/tunnel 或浏览器端 registry script 是否按计划加载。
