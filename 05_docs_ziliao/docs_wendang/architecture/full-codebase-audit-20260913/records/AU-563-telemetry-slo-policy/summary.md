# AU-563｜遥测 SLO、恢复与脱敏政策目录

- 审阅范围：`02_platform_pingtai/config/telemetry.yml`（20 行）；定向阅读唯一仓内 test consumer、backup RPO/RTO values 与既审 telemetry package。
- 审阅方式：配置/消费者人工阅读；尝试执行 `node --import tsx --test 03_quality_ceshi/tests/recovery/runbook.spec.ts`。

## 真实运行关系

telemetry YAML 的 rpo/rto → recovery runbook spec 的文字匹配 → database failover/migration rollback runbook evidence；同值也在 Aliyun backup YAML 出现。其它 latency/availability/outbox SLO和redaction deny keys未见 runtime telemetry/alert/redactor consumer；`@shop/telemetry`拥有独立的 Redactor 规则（AU-013/F-0065）。

## 审计结论

- **F-0261（P3，高置信）**：八项 latency/availability/outbox SLO和六项 redaction deny tokens只存在 telemetry.yml；仓内唯一代码 consumer仅断言 `rpoMinutes: 5` 与 `rtoMinutes: 30` 的字面值。该文件不能实际设定 alert/SLO或 `@shop/telemetry` 脱敏行为，易让维护者误以为策略已经生效。
- RPO/RTO当前与 backup YAML一致；这只证明仓内声明一致，不是线上备份或恢复演练证据。
- **定向验证未执行**：recovery spec 在加载 commerce `JOB_CATALOG` 时因当前 worktree resolver 缺少 `@shop/config` package退出，未到达 telemetry/runbook assertions；未安装依赖或改变环境。

## 未验证项

- 未验证线上 metrics/alerts/redaction、真实 RPO/RTO、runbook 执行、backup/restore，或完整 workspace test runner下的 recovery spec结果。
