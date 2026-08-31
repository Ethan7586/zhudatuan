# 筑大团部署总览

正式部署只接受同一提交生成并签名的 `auth`、`console`、`storefront`、Commerce OCI 与一份 Canonical Migration 历史。部署拓扑和控制文件只来自：

```text
infrastructure/container
infrastructure/cloud
infrastructure/network
infrastructure/monitoring
infrastructure/backup
infrastructure/security
```

## 发布顺序

1. 校验 Release Manifest、源码/合同/Operation/Event/Job/Requirement/Migration/Ownership/Extension/Runtime Hash。
2. 校验 SBOM、许可、Build Provenance、Stage Evidence 与 Sigstore Bundle。
3. 打开维护窗并排空写流量，验证数据库快照。
4. 运行只向前 Migration，等待独立 Migration Job 完成。
5. 发布三个不可变静态客户端和 API/Jobs 运行时。
6. 执行 Smoke，并按 `1% → 10% → 50% → 100%` 切流。
7. 每档检查错误率、p95/p99、数据库锁等待、连接池、Queue/Outbox Lag、账务平衡、订单/支付/券对账、跨 Scope 告警和 Provider 错误率。
8. 任一阈值失败自动回滚流量；数据库只允许前向修复。
9. 导出并验证不可变 Cutover Evidence 后关闭维护窗。

实际入口为 `infrastructure/cloud/Deploy.sh`，必须由受审计的 `SHOP_CUTOVER_CONTROLLER` 驱动；脚本拒绝未签名、无快照、无批准、无回滚证据或客户端集合漂移的制品。

## 高可用与恢复

- API 常态 3 实例、最少 2 实例，跨两个 AZ Active/Active。
- Jobs 跨 AZ，PostgreSQL Lease 使用单调 Fencing Token。
- PostgreSQL 单写 Primary、同步 Standby 和只读副本。
- Redis Primary/Replica，只作可重建缓存，不承担正确性。
- Queue 使用 3 节点 Quorum；对象存储私有、版本化、跨区域复制。
- 第二地域 Warm Standby；目标 RPO 不超过 5 分钟、RTO 不超过 30 分钟。

恢复、备份、对账和发布证据详见 `docs/operations/deployment.md` 及对应 Runbook。
