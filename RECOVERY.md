# 发布灾难恢复

状态：REFERENCE

仅保留两个明确隔离的旧恢复入口：

- `legacy-direct-recovery-aliyun.yml`：Legacy 1.2 直接恢复，包含现场构建，并保留 H6 CDN 的独立恢复能力。
- `legacy-oss-recovery-aliyun.yml`：Legacy 1.2 武汉 OSS 恢复，包含现场构建和历史组合目标支持。

它们只在 Ethan 对具体恢复任务明确授权时人工使用，不得由 `zdt-delivery`、Delivery Control 1.4.3、自动封板或任何普通 Prepare/Deploy 路径调用。两者是非正常部署通道，不能作为日常发布替代方案。

旧质量、旧 Prepare、旧 Deploy、旧 OSS Deploy 和一次性 baseline 登记工作流均为不可运行的 `Retired` stub。历史 engine 动作可留作取证与代码追溯，但没有普通入口。

彻底删除两个 Legacy Recovery 的外部条件仍是：全部实际部署位已有可验证的 1.4.3 恢复覆盖，H6/边缘能力已有独立安置，并完成真实恢复演练。在这些事实成立前，只能称其为保留的灾难恢复能力。
