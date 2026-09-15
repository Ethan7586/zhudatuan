# AU-795｜Registration bootstrap 部署声明门禁

- 审阅范围：`check/registration-deployment.mjs` 与 delivery/build/package/systemd/environment/bootstrap/RDS init/reconciliation/runner/PG fixture输入。
- 审阅方式：深读 registration boundary one-shot、minimal DB role/ACL、RDS sentinel/target guard、不可变 migration checksum和fixture source assertions；运行只读静态入口。

## 审计结论

- **G0：保留。** checker意图证明 registration bootstrap 仅通过 systemd one-shot、受限 database role 和独立 registration boundary 执行。
- **F-0308 / P2：** checker要求根 package script `bootstrap:registration:production` 精确存在，当前 package.json没有该 script；构建 entry与delivery one-shot仍引用 `BootstrapRegistration`。验证在此提前失败，后续 systemd/RDS/reconciliation/migration assertions未执行。
- **限制：** 未运行 bootstrap、RDS init、reconciliation或PG16 fixture；静态失败不能证明 one-shot 已实际失败或 registration DB 已被改变。
