# RV-0076｜Web Business API 启动兼容性门独立复核

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`；仅静态审阅，未启动服务、连接数据库或变更部署状态。
- 对象：F-0249 及关联 F-0250，`WebBusinessApiMain` 的兼容性检查、就绪端点和 systemd 启动链。

## 重查调用链

- `createWebBusinessApiRuntime` 确实将首轮 `assertWebBusinessRuntimeCompatibility` reject 写为 `WEB_BUSINESS_RUNTIME_COMPATIBILITY_WARNING`，随后 main 继续创建 handler 并 `listen`。
- 但两套受控 unit（`sfl-web-api@.service` 与 `zhudatuan-web-api.service`）均以 `WebBusinessApiReadyMain.js` 作为 `ExecStartPost`。该入口轮询 `/health/ready`；运行模块再次调用 `webBusinessRuntimeCompatibility`，不兼容时返回 503，因此 post-start 失败会使受控 unit 不能以成功启动状态保留。
- 这不是完整防线：已成功启动后发生数据库/权限状态漂移时，主进程不会主动停止，只会使 readiness 变为 503；并且 compatibility helper 查询 `contract` checksum，却未将 `!state.contract` 纳入 reject 条件（F-0250）。release remote policy 的后续 health 检查也只验证 systemd active。

## 结论

- **F-0249 从 P1 降为 P2。** 初始启动阶段存在的 unit-level readiness gate 推翻了“任意兼容性失败仍持续对外监听”的 P1 因果链。固定基线未证明生产 unit 绕过该 gate 或出现已运行实例的危险状态。
- 运行中漂移、active-only 后续健康检查和 contract checksum 漏检仍是需要治理的真实边界，但没有证据显示正在造成数据损坏、安全事故或重大线上故障，故不是 P0/P1。
- 后续从最新主线建立单一运行时健康治理批次：在隔离数据库分别破坏每个 compatibility 状态和单独 contract checksum，验证 ExecStartPost、运行中 readiness、supervisor 反应及无业务请求继续处理；回滚为撤回该批次。
