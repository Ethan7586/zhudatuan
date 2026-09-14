# AU-719｜本地基础设施工具

- 审阅范围：`04_tools/tools/localinfra/src/` 的 11 个尚未覆盖文件，连同根 package scripts、local secret/KMS/object consumers和既有 source tests。
- 审阅方式：深入审阅有写入、secret、TLS、进程启动与验证行为的实现；同源测试作结构性审阅。未执行 `local:prepare`、`local:services`、`local:verify-services` 或任何会创建本地凭据/对象的命令。

## 运行关系

- 根 scripts 通过 `Launch.mjs` 运行 Prepare、Run、Verify、migration/seed；Prepare 可生成私钥、local secrets、数据库 URL 与各 app `.env.local`，并将敏感文件权限收窄。
- `RegistrationReady` 只等待 secret-store/KMS（full-staging 时加 object store）；`Verify` 对这三项做 HTTPS、secret、KMS roundtrip 与 object upload/read 合同验证。
- public `@shop/localinfra` surface 只导出 `localFetch`、`localJson`、`localSecret`，被 seed 工具用作本地 secret/client 边界；TLS proxy 与 password/HTTP tests验证各自 fail-closed 输入。

## 审计结论

- **G0：全部保留。** 这不是生产运行代码，但它是正式本地准备、迁移、seed 和服务验证入口；不能因仅开发环境使用而删除。
- 新增 **F-0292（P3）**：`local:verify-services` 每次成功执行都会完成一个带 UUID 的 object upload，但没有删除/过期路径，长期重复验证会累积本地 object store 内容。
- 无 P0/P1/P2。未运行定向测试：正式入口会写本地对象，超出本次只读审计授权。

## 未验证项

- 未验证已有 local state 的权限、secret 内容、TLS 可用性或 object-store 的实际保留策略。
- 未验证 object service 是否有仓外生命周期清理；结论仅限此 command 本身没有 cleanup 调用。
