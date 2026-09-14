# AU-506｜Web Business API runtime 测试与启动门

- 审阅范围：`01_core_hexin/services/commerce/src/bootstrap/WebBusinessApiRuntime.test.ts`（66 行）；定向追踪 `WebBusinessApiRuntime.ts`（263 行）与 `WebBusinessApiMain.ts`。
- 审阅方式：逐段人工阅读测试、runtime 与 deployed entry；静态追踪，未启动 API、连接数据库或读取生产日志。

## 真实运行关系

每个 sovereign node 的独立 Web Business API 入口 → environment → node manifest/origin 校验 → Secret Store 数据库连接 → compatibility 检查 → bootstrap modules/operations → `PublicCatalogHttpHandler` → `listen`。compatibility 查询专用 web API role、运行 schema/contract、web business marker、表/函数、受选写权限及 payment/finance 禁写边界。

## 审计结论

- **F-0249（P1，高置信，需独立复核）**：runtime 对 `assertWebBusinessRuntimeCompatibility` 的任何拒绝均 `.catch` 为 `WEB_BUSINESS_RUNTIME_COMPATIBILITY_WARNING`，随后继续创建 access/handler 并由 entry listen。故 dedicated role、role safety、recovery state、schema/contract marker、函数/表/授予权限或 finance/payment 禁写边界失效都不会阻止 API 进程启动。测试只验证 helper 会 reject，没有覆盖 deployed startup 是否 fail-closed。
- **F-0250（P2，高置信）**：即使上层移除 warning catch，helper 的拒绝条件也遗漏已查询的 `state.contract`；Web Business API 可以在 contract checksum 不一致时通过其自身 compatibility helper。该项与 F-0247/F-0248 是同类跨 runtime 证据，但在本模块独立成立。
- node profile/features/surfaces/application/origin/lifecycle 断言，以及 web API 对 payment/finance 写入禁止矩阵，均有真实运行/安全职责，结论 **G0**。

## 边界与未验证项

- 数据边界：web API 以受限读写进入 catalog、benefit、access/audit 等，并在 SQL 中禁止 payment/finance 宽泛写入；真实 DB grant/RLS、业务路由和操作注册需专项复核。
- 用户影响：静态证据证明不健康部署仍可开监听；没有生产不健康实例、越权写入、泄露或错误响应的运行证据。
- 独立复核方法：在隔离 PostgreSQL 分别破坏 role、contract、forbidden write grant 与必需表/函数，启动真实 entry，确认其是否在 `listen` 前退出；重新检查 warning catch 是否存在替代外部健康 gate。
