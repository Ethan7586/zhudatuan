# RV0066｜GX-0046 Storefront compatibility legacy 运维

- 当前 purchase deployment check 仍读取 compatibility `deploy.sh`，用于阻止旧 Caddy reload 路径重新进入新发布控制面；故不能按静态零引用删除。
- root backup timer/service 与实际 OSS/RAM/恢复路径未在本次审计中执行或访问，维持 GX。
- 已登记 F-0296/P2：check 固定旧 API host，当前 Caddy host 不匹配，安全门无法完成验证；非 P0。
