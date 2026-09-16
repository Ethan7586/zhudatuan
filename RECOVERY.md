# 发布灾难恢复

状态：REFERENCE

仅保留一个明确隔离的旧恢复入口：

- `legacy-oss-recovery-aliyun.yml`：Legacy 1.2 武汉 OSS 恢复，包含现场构建和历史组合目标支持。

它们只在 Ethan 对具体恢复任务明确授权时人工使用，不得由 `zdt-delivery`、Delivery Control 1.6 或普通 `release` 路径调用。两者是非正常部署通道，不能作为日常发布替代方案。

旧 Prepare、Prepared Deploy、Seal、Closure、Runner Lease、Writer Lease、Doctor、Reconcile、历史 engine 及不可运行的 `Retired` workflow stub 已删除，不再作为可执行代码保留。Git 历史仍可用于取证。
