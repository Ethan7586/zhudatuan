# AU-504｜Identity notification Jobs runtime 测试与启动兼容性

- 审阅范围：`01_core_hexin/services/commerce/src/bootstrap/IdentityNotificationJobsRuntime.test.ts`（118 行）；为还原入口/门禁，定向追踪 `IdentityNotificationJobsRuntime.ts`、`IdentityNotificationJobsMain.ts`、`IdentityNotificationJobsOnlyMain.ts` 与 `IdentityNotificationJobsReadyMain.ts`。
- 审阅方式：逐段人工阅读测试、运行时和入口；静态追踪，未执行 Worker、数据库、短信或 Secret Store。

## 真实运行关系

`identity-notification-only` 启动入口 → `runIdentityNotificationJobs` → `createIdentityNotificationJobsRuntime` → Secret Store 取 job 数据库连接 → `assertIdentityNotificationRuntimeCompatibility` → 专用 `identitynotification` 队列 claim → identity challenge 通知派发。就绪入口也直接创建同一 runtime，故共享兼容性门。可选 node manifest 限制 operating-mall、identity feature、secret namespace 与生产 active 生命周期。

## 审计结论

- **F-0247（P2，高置信）**：兼容性 SQL 同时查询 migration head 与 `runtime.schemaversion` 中的 contract version/checksum；但拒绝条件遗漏 `state.contract`。测试明确将 `contract: false` 固化为可成功启动。故有迁移 head、专用表和 registration，但 runtime contract checksum 不匹配时，通知 Worker 仍可取得凭据并开始 claim/派发任务。未验证任何生产数据库发生该不一致，亦未执行副作用。
- 队列职责为 **G0**：测试确认默认路径调用专用 `runtime.claim_identity_notification_job`，并不退回 generic `runtime.claim_job`；有 node scope 时使用候选 SQL 并携带 scope。该实现有明确后台运行职责，不是删除候选。
- node manifest/secret binding 断言为 **G0**：其保护 node feature、secret namespace 和生产 lifecycle；不得因当前只在启动路径出现而删除。

## 边界与未验证项

- 数据/异步边界：runtime.job 是 identity 通知的唯一消费者；SQL claim、lease、重试、幂等与实际投递结果需在隔离 PostgreSQL/消息通道中复核。
- 权限/凭据边界：Secret Store bearer、KMS bearer 仅在 bootstrap 必填；本单元未读取真实凭据或日志。
- 建议的独立验证：用隔离数据库保留目标 schema head、故意改坏 contract checksum，创建 runtime 前应在任何 claim/派发前拒绝；确认后再由独立修复分支改动 gate 与回归测试。
