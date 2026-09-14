# AU-503｜Canonical Commerce Jobs 环境模板深审

- 审阅对象：`01_core_hexin/services/commerce/.env.jobs.example`（19 行）。
- 方法：人工审阅全文；静态追溯 `jobsEnvironment`、JobsMain/专用 Jobs entry 与 runtime bootstrap。未读取实际环境或凭据，未启动 Worker。

## 结论

- **G0**：模板保留 jobs 专用数据库/Redis、扩展/KMS/对象存储与异步服务配置参考，且不含会话/浏览器密钥或实际凭据。
- **F-0246 / P3**：该模板遗漏 `JOB_RUNTIME_PROFILE`、`SECRET_STORE_BEARER_TOKEN` 和 `KMS_BEARER_TOKEN`。`jobsEnvironment` 强制 profile；identity/payment 专用 profile 又会拒绝模板包含的其它不允许键。故模板不能直接形成任何已验证的 Jobs runtime 环境。
- 未验证 full profile 的完整必填集、localinfra 生成流程、目标 node manifest、Secret Store/KMS 注入、数据库 job role、队列/死信与实际 worker 生命周期。
