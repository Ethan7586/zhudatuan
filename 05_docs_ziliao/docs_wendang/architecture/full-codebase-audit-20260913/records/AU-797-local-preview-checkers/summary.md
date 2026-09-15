# AU-797｜本地预览数据库与运行时检查器

- 审阅范围：`check/local-preview-database.mjs`、`check/local-preview-runtime.mjs`。
- 审阅方式：深读 local-only DB read-only guard、branch/base/dirty attribution、lockfile/migration ledger、candidate attribution、可选 runtime config write与服务探测；只执行 `--source-only`，未连接数据库、未启动服务、未传 `--prepare-runtime-config`。

## 审计结论

- **F-0310 / P3：** runtime checker硬编码 `codex/product-000a-baseline-isolation` 与旧 base SHA，并将历史基线后的每个 migration 中普通 `insert/update/delete runtime.schemaversion` 均视为非法 ledger mutation；在当前固定审计基线上报 branch/base mismatch、大量 migration errors和用户已有审计队列 dirty files，不能提供当前本地预览的可判读结果。
- **DC-0087 / G1：** 两脚本没有根 package/workflow 自动入口，但 database tool具备 loopback/read-only强约束，runtime tool可验证候选归属和本地服务一致性；仍可能由人工受控 preview流程调用。`--prepare-runtime-config`会写 local secrets，默认 runtime模式还会访问本地服务，故本审计不执行。
