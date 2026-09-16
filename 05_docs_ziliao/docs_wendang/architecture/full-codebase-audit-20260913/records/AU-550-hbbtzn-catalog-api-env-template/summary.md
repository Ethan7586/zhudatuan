# AU-550｜hbbtzn L1 catalog API 环境模板

- 审阅范围：`02_platform_pingtai/config/node-runtime/hbbtzn-l1/catalog-api.env.example`（18 行）；定向核对 hbbtzn node manifest、项目部署单元、remote release policy 与 generic systemd template。
- 审阅方式：环境键、部署/运行入口与发布 target 人工追踪；未启动服务或读取线上环境。

## 真实运行关系

generic `sfl-catalog-api@.service` 可从 `/opt/sfl/nodes/%i/runtime/catalog-api.env` 启动 catalog operator API；模板定义 hbbtzn L1 的 node manifest/config/pointer/database/secret/object-store refs。但 hbbtzn project deployment 将 catalog responsibility 绑定 `sfl-catalog-api@zhudatuan-l0.service`，而 remote policy 仅在 zhudatuan-l0 声明 catalog-api artifact target，hbbtzn-l1 target 集合没有 catalog-api。

## 审计结论

- **F-0260（P2，高置信）**：hbbtzn L1 catalog API env template 与仓内可部署/restart topology 不一致。若按模板准备 L1 runtime file，现行 remote delivery 不会将 CatalogOperatorApi 制品交付到 L1 target；若按 deployment 文件运行，则会消费 L0 runtime/pointer，而非模板中的 L1 refs。
- 模板无真实 bearer 值，所有 credential 变量为 replace placeholder；`NODE_MANIFEST_ID`、runtime instance/config、release pointer 与当前 hbbtzn L1 manifest 对齐。
- hbbtzn project `releaseEligible:false`，所以当前没有该模板已造成线上错配的证据；generic systemd 对 L1 instance 的存在说明它不能据“无 remote target”被判为垃圾。

## 未验证项

- 未验证是否有外部/provisioning layer 将 L1 catalog traffic 映射回 L0、实际 hbbtzn runtime files、DNS/tunnel route 或此 template 的历史/未来 activation 计划。
