# AU-737｜hbbtzn 配置型租户部署边界

- 审阅范围：hbbtzn README、project identity、L1 Console 与 Storefront Caddy 路由片段。
- 审阅方式：深入审阅 shared-artifact/no-fork/release-ineligible 数据与部署边界；对两个同构 Caddy snippet 审阅 header predicate、静态根目录和仓内接入关系。未检查节点 Caddy active config、DNS、Worker 或流量。

## 审计结论

- `project.yml` 与 README 一致指定 shared platform artifacts、禁止 fork、releaseEligible=false、共享数据库但 node/Mall scope 隔离；它是配置型租户身份而非第二套应用代码。
- 两份 Caddy snippet 以 `X-SFL-Node-ID=node:hbbtzn:l1` 与 surface header 限定静态 Console/catalog-media 服务。固定基线未找到其被当前 Caddy 主配置、发布配置或脚本导入的仓内证据；但 README 明确保留 hbbtzn，外部节点配置、alias Worker、历史回滚和租户边界均未排除。
- **G0：README/project identity 保留；G1：两份 Caddy snippet 暂不删除。** 已新增 DC-0078，不将“仓内无引用”升级为删除结论。
