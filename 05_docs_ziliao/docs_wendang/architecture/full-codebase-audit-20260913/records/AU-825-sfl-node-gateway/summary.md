# AU-825｜SFL Node Gateway 配置生成器

- 审阅范围：`04_tools/scripts/release/generate-sfl-node-gateway.mjs`（128 行）及两个 provisioner 导入点。
- 结论：从 active node manifest 和显式端口生成 Caddy 配置；验证节点 ID、manifest schema/lifecycle、端口、各 surface 的唯一/非歧义主机绑定。它将订单读写、支付、Webhook、商品、身份、前端 SPA、运行时配置和未知主机边界分别路由，并清除来自代理的节点/身份入口头。
- 验证：内存 manifest 的配置包含支付 Webhook、421 主机边界拒绝及敏感头清除；非法节点 ID 被拒绝。未写文件、未启动代理或服务。
- 边界：命令行模式仅输出或比较配置；实际写入、加载和切流在调用方/发布运行单元，后续单独审计。本生成器归 **G0**。
