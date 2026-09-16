# AU-551｜hbbtzn L1 catalog jobs 环境模板

- 审阅范围：`02_platform_pingtai/config/node-runtime/hbbtzn-l1/catalog-jobs.env.example`（37 行）；定向阅读 `CatalogJobsRuntime`、generic jobs systemd 与 L0/L1 release targets。
- 审阅方式：环境契约、启动代码、制品入口人工追踪；未启动 worker 或读取线上环境。

## 真实运行关系

catalog jobs env → `sfl-catalog-jobs@.service` → `CatalogJobsMain`/`CatalogJobsRuntime` → Secret Store DB connection + worker id + optional catalog media replication. Generic instance service 支持 `%i` node，但正式 remote policy 与 hbbtzn project deployment 只把 catalog-jobs target/restart 配置在 zhudatuan-l0。

## 审计结论

- **F-0260 补强（P2）**：此 L1 catalog-jobs template 与 AU-550 catalog API 有相同漂移：模板绑定 hbbtzn L1 DB/node/pointer，实际可交付/restart 的 catalog worker 为 `sfl-catalog-jobs@zhudatuan-l0.service`，hbbtzn-l1 remote target 不含 catalog-jobs。
- `CatalogJobsRuntime` 实际读取 DB job ref、role、worker id 与全部 media keys；模板中对象存储、secret store、OSS access fields 都是 `REPLACE_WITH…` 占位符，无明文凭据。
- `CATALOG_MEDIA_REPLICATION_ENABLED=false`，所以模板中的双目标 OSS 参数在默认运行不激活；若设 true，runtime 要求 primary target 及对应 media endpoint/bucket/credential 字段。

## 未验证项

- 未验证真实 runtime env 是否存在、L1→L0 delegation、media replication 数据一致性/权限、或 worker shutdown/retry；仍不能把模板或 generic systemd 判为可删除。
