# AU-743｜Full staging 就绪门禁编排

- 审阅范围：`verify-readiness`、其 evidence/gate contract、candidate、云主机、数据库角色、systemd、工具链、Full Jobs 与共用安全 I/O helper。
- 审阅方式：以 CLI 入口反向阅读每个 live gate 的实际调用和失败条件；候选、主机、数据库与 systemd 入口深入审阅，通用 helper 与固定格式证据模板结构性审阅。未访问阿里云、目标主机、数据库或真实 evidence。

## 审计结论

- **G0：该链路是 staging 的 fail-closed 发布门禁，不是部署器。** 只有固定路径、root-owned 0600 live evidence 才会触发主机检查；示例 evidence 只做格式校验。每个 P00–P12 gate 都要求本 gate 及先前 gate 的字段/`checks.*` 完整，过期会话也会阻断后续 gate。
- 候选制品 gate 验证 release manifest、archive、逐文件 inventory、无符号链接和 candidate/current 的 commit 绑定；云 gate 通过 IMDSv2 固定验证 staging ECS ID、北京 region/zone、唯一 RAM role，且明确拒绝生产实例和生产公网地址。
- 数据库 gate 对 loopback DSN、7 个退役角色、3 个 runtime 登录角色、4 个 boundary `NOLOGIN` 角色、membership、函数 ACL/owner 做 live 校验；systemd gate 同时验证 source=installed、root 0644、无 drop-in、DynamicUser、输入文件和 executable marker。
- `full-jobs` 从代码起即带 `provider-sandbox-not-integrated` 缺项，并强制 unit 保持 `ExecCondition=/usr/bin/false`、inactive/static；这是已声明的安全停机态，不能视作运行就绪，也不是垃圾文件。
- 定向执行示例验证未开始进入业务校验：本审计 worktree 缺少 `pg` 包，ESM 在加载 `readiness-database.mjs` 时即失败。未安装依赖或绕过正式入口；该结果仅说明本地审计环境无法运行此门禁，非线上失败证据。
