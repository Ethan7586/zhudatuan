# AU-784｜调用图完整性门禁

- 审阅范围：`04_tools/scripts/check/calls.mjs`，以及它聚合的 database/events/jobs/extensions/operations/routes callgraph 输入。
- 审阅方式：深读 source collection、入口识别、边界方向、export binding、可达性与聚合器接口；执行 parser self-test 与固定基线完整静态扫描。

## 审计结论

- **G0：保留，但当前全量输出不可作为可信架构事实。** 脚本使用 TypeScript AST 解析并聚合多类调用关系，其自测通过；但根路径/retired-name 规则停留在重组前结构。
- **F-0304 / P2：** `entrypoints`/`boundaryDetail` 判定顶层 `apps/services`，当前源码均在 `01_core_hexin/*`；`retiredParts`又把仍存在的 `auth-web/storefront-web` 等目录当硬切目标。固定基线全量扫描产生679项混合输出（含大量 unreachable、retired、database caller），无法从结果中分离真实违规与规则假阳性。
- **限制：** 本批不将任何 `UNREACHABLE_PRODUCTION_SOURCE`、`FORBIDDEN_*` 或聚合器项升为垃圾/删除候选；各运行单元和数据库调用仍以已完成的架构/模块审计证据为准。
