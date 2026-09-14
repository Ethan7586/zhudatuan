# AU-565｜数据库对象契约生成目录

- 审阅范围：`02_platform_pingtai/database/contracts/objects.yml`（30,299 行）；定向阅读对象目录生成器、fresh database object-contract verifier 和 release migration artifact wiring。
- 审阅方式：生成来源、schema/consumer boundary和目录统计人工阅读；不执行 generator（它会写覆盖本文件）。

## 真实运行关系

SQL migrations（自 `20260821011000`）→ `build-database-object-contract.mjs` 正则解析 create/drop/alter grant/policy/trigger → generated objects.yml → fresh replay `verifyObjectContract` 与 real PostgreSQL catalog/RLS/grant comparison → migration release artifact critical file。生成器无 `--check`，普通运行会写入 objects.yml。

## 审计结论

- **自动生成**：当前 catalog version 1，4,499 objects：325 tables、233 functions、2,906 grants、914 policies、32 schemas、88 triggers、1 view；31 objects列出静态 caller，306带 operationalOwner。它是迁移派生对象目录，不能逐行作为人工业务代码审阅，也不能作为生产 catalog事实本身。
- **G0**：release policy将它随 history.json纳入 database migration candidate/critical files；fresh DB verifier将期望 schema/table/view/function/trigger/policy/grant/RLS 与数据库 catalog做双向 compare，能在依赖完整的可重放环境发现解析/生成漂移。
- generator仅从阈值后的 migrations 解析且保留数个显式 stage table排除/默认 grant-policy补足规则；这使其自身规则成为数据库契约生成边界，任何调整都须专门验证真实 catalog。

## 未验证项

- 未运行会写文件的 generator、fresh replay或 PostgreSQL object verification；正式 inventory也因缺 `pg` 依赖未启动。未审每条 SQL/object 所属业务语义或线上 catalog。
