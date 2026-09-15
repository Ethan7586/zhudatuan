# AU-764｜数据库合同验证器

- 审阅范围：`04_tools/scripts/audit/database-contracts.mjs`；`database.mjs`/`migrations.mjs` 的调用关系仅作入口核对，分别保留给后续包装器单元。
- 审阅方式：深入审阅 mode dispatch、migration inventory/history/hash、PGlite/PostgreSQL open、migration replay/ledger、seed/precondition、RLS/audit/extension/experience/object contract 检查，以及 MVP/identity-realm 下游。
- 定向验证：`npm run check:migration-inventory` 未启动任何检查，模块加载即因审计工作树无法解析 `pg` 而报 `ERR_MODULE_NOT_FOUND`；未安装依赖、未连接数据库、未执行迁移。

## 审计结论

- **G0：保留。** 这是 `test:sql`、`test:mvp`、schema/Pg fresh replay、inventory-cutover、identity realm 和多份 PG17 fixture 的统一数据库合同入口；它以固定 migration history、对象清单和 role-aware catalog set comparison 约束迁移的可重复性与对象边界。
- **验证边界：** PGlite/临时 PostgreSQL replay 不能替代真实生产 ledger、extension 版本、role inheritance、RLS、长期数据与并发；`--postgres-fresh` 仅可指向明确授权的 disposable URL。当前工作树依赖链接缺失使本 AU 的实际定向命令未验证。
- 注册/库存/owner/identity 的 hard-coded migration allowlist、omission map 与 fixture preconditions 是重要的历史兼容语义；不得以“静态无调用”或测试复杂为由删除。
