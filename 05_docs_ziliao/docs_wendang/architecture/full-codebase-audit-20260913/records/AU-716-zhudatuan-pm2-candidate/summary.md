# AU-716｜Zhudatuan PM2 运行候选配置

- 审阅范围：`02_platform_pingtai/infrastructure/zhudatuan/aliyun/ecosystem.config.cjs`，以及其交付声明、安装调用和固定基线的运行状态说明。
- 审阅方式：深入审阅两个 PM2 process definition、交付配置中的引用和安装脚本的候选安装语义；未启动进程、未触碰任何线上资源。

## 运行关系

- 该配置声明旧式 PM2 的 `zhudatuan-storefront`（target storefront, port 3000）和 `zhudatuan-api`（legacy `ApiMain.js`, port 3001）两个 fork process。
- `delivery.yml` 将其列为 processConfig；release-engine 会把它打包进运行定义安装包。
- 实际安装脚本仅把它放入 `/etc/ai-delivery/candidates/zdt-next.ecosystem.config.cjs`，并明确声明这个 PM2 storefront candidate 保持 inactive；当前标准的 API 子进程由 systemd 及 4321/4322/4323 分端口配置描述。

## 审计结论

- **G0：不属于可删除代码。** 虽然固定基线没有把它作为已激活服务的证据，但它被正式交付链引用并作为候选运行定义安装；不能仅凭未启动或端口与当前分端口服务不同就删除。
- 未新增问题：候选 PM2 配置与当前 systemd 拓扑不同是明确的候选/非激活边界，而不是已证实的线上冲突。

## 未验证项

- 未核对生产主机 candidate 文件是否存在、是否有仓外 PM2 激活程序或历史回滚依赖。
- 未验证候选启动后是否仍可和当前 Caddy/systemd/runtime artifact 配置兼容；任何激活前必须独立做受控运行验证。
