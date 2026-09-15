# AU-765｜数据库验证包装器

- 审阅范围：`database.mjs` 与 `migrations.mjs`。
- 审阅方式：两个文件是 AU-764 主数据库合同验证器的薄包装；结构性审阅 argv、顺序、stdout/stderr/exit propagation 和 root package entry。

## 审计结论

- **G0：两文件均保留。** `check:database` 固定转发 `--schema-fresh`；`check:migrations` fail-fast 顺序执行 `--check-inventory → --schema-fresh → --inventory-cutover-unsafe`，完整转发输出及非零退出码。
- 真实 migration/RLS/catalog 语义以 AU-764 为准；包装器自身不新增数据库连接、SQL、环境变量或写入逻辑。未重复执行会建隔离数据库的下游模式。
