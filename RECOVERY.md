# 发布灾难恢复

状态：REFERENCE

仅保留两个明确隔离的旧恢复入口：

- `legacy-direct-recovery-aliyun.yml`：Legacy 1.2 直接恢复，包含现场构建，并保留 H6 CDN 的独立恢复能力。
- `legacy-oss-recovery-aliyun.yml`：Legacy 1.2 武汉 OSS 恢复，包含现场构建和历史组合目标支持。

它们只在 Ethan 对具体恢复任务明确授权时人工使用，不得由 `zdt-delivery`、Delivery Control 1.6 或普通 `release` 路径调用。两者是非正常部署通道，不能作为日常发布替代方案。

旧质量、旧 Prepare、旧 Deploy、旧 OSS Deploy 和一次性 baseline 登记工作流均为不可运行的 `Retired` stub。历史 engine 动作可留作取证与代码追溯，但没有普通入口。

历史 engine 仅暴露 direct recovery 所需的 plan、build、package、deploy、channel 及现有恢复辅助动作；Seal、Closure、Runner Lease、Writer Lease、Doctor 和 Reconcile 不再有普通命令入口。
