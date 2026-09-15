# AU-746｜Storefront compatibility 遗留运行与异云备份

- 审阅范围：legacy Aliyun/Cloudflare 文档、PM2 configs、备份环境模板和 systemd timer/service。
- 审阅方式：深入审阅会启动进程、重载 Caddy 或读取 backup secret 的脚本/单元；同构 PM2 config 和文档做代表性审阅，并反向检查当前 `zhudatuan` delivery 的 forbidden inputs 与 purchase release check。未执行 PM2/systemd/Caddy/备份或云操作。

## 审计结论

- **GX：全部保留，禁止删除。** 当前 `zhudatuan` delivery 明确把该 legacy Aliyun 目录列为 forbidden input；但 `purchase-deployment.mjs` 仍读取 legacy `deploy.sh`，以确保旧的 Caddy reload 路径不重新进入新 release control plane。备份 timer/service 还可能由仓外 systemd 注册，静态零引用不能作为删除依据。
- backup service 为 root oneshot，读取 0600 主机环境、只开放 backup 目录写入；timer 持久化每日执行。它不应与在线主库或应用图片桶混用，但实际 OSS/RAM/备份恢复从未验证。
- default/identity PM2 profile、Cloudflare README 描述的是旧 smart-wing/hbbtzn 拓扑，和当前 Full staging 或新的 `zhudatuan` control plane 不同。该差异形成 F-0295 的更广泛历史控制面背景。
- **发现 F-0296（P2）：** 当前 purchase deployment check 固定在 `api.zhudatuan.com` Caddy block，而基线 Caddy 已切换为 `api.fufu.wang`；定向检查实际失败于 `CADDY_HOST_BOUNDARY_MISSING`，无法验证它宣称的 public purchase 503 safety gate。
