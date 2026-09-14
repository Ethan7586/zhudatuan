# AU-559｜zhudatuan L0 catalog jobs 环境模板

- 审阅范围：`02_platform_pingtai/config/node-runtime/zhudatuan-l0/catalog-jobs.env.example`（37 行）；定向复核 CatalogJobsRuntime 和 L0 remote target。
- 审阅方式：环境契约、jobs/media配置及制品入口人工追踪；未启动 worker、OSS 或数据库。

## 真实运行关系

L0 catalog jobs env → `sfl-catalog-jobs@zhudatuan-l0.service` → CatalogJobsRuntime → Secret Store DB ref + catalog job worker + object storage；remote policy 将 CatalogJobs artifacts/pointer/restart/health check绑定至同一 L0 instance。media replication false 时仅建立 primary catalog media storage，true 时会基于 template 的 target-specific OSS configs 构建 replication topology。

## 审计结论

- **G0**：DB job ref/role、worker id、object/secret endpoints、L0 manifest/runtime/pointer 都与当前正式 target 对齐；无 AU-551 所见的 L1/L0 deployment ownership conflict。
- 两组 OSS provider/bucket/credential均为 placeholder，且 replication默认关闭；`CATALOG_MEDIA_PRIMARY_TARGET_ID=zhudatuan` 与 L0 owning target一致。现有 Worker runtime 将 media fields作为 optional switch受控消费。

## 未验证项

- 未验证真实 worker DB privileges/lease/retry、object store readiness、OSS credentials、media复制幂等/失败恢复、systemd health或生产 job traffic。
