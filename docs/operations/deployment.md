# 福利商城发布运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

签名候选发布、紧急安全修复、Canary 异常、迁移失败或六端版本漂移时触发。正常发布为受控变更；签名/Hash/合同/数据不变量失败为 P0 发布阻断，线上 SLO 燃尽或交易不变量异常为 P0 事件。影响范围按内部 Tenant/Mall Canary 确定，不能用全量流量试错。

## Owner 与前置权限

Release Commander 主责，Reliability、Database、Security、Api、Jobs、Provider、Frontend 与领域 Owner 分阶段签字。执行身份必须为短时工作负载身份并受双人审批；生产只接受同一 Release Bundle 中的代码、配置、迁移、Extension Manifest、SBOM、合同、Api/Jobs/Provider/Migration 镜像和 auth/console/storefront/miniapp/store/supplier 六端制品。禁止生产拉源码、重建、使用长期凭据或现场改供应商规则。

## 只读诊断（Diagnosis）

以 `{releaseDirectory}` 运行 `infrastructure/cloud/Deploy.sh /absolute/path/to/signed-release` 的只读验证阶段，核对 Sigstore、`checksums.sha256`、镜像 Digest、合同 Hash、Schema Head、配置 Hash、Extension Hash、SBOM、Provenance、六端 Bundle、测试证据和批准签字。读取当前 Release Head、迁移 Phase、Canary Scope、Outbox/Inbox 水位、Job Lease 和十项业务不变量；不得输出 Secret。

## 止血（Stop loss）

任一 Gate 失败立即停止后续 Stage；Canary 失败冻结新 Scope 写入并保持健康版本服务其他 Scope。Migration Retire 前保留旧应用/结构的受控恢复能力；支付 Unknown、库存异常、账务不平、凭证重复或跨 Scope 立即暂停相关写入。不得双写、不得旧新实例共同访问硬切后的写模型、不得绕过门禁。

## 恢复（Recovery）

严格由 `infrastructure/cloud/Delivery.yml` 执行：artifactverify → snapshot → migrationprepare → migrationbackfill → migrationassert → runtimecanary → contractcutover → clientpublish → fullrollout → migrationretire → evidencearchive。Api、Jobs、Provider 使用同一镜像不同入口，Migration 为单实例阶段任务；每个 Runtime 通过 Startup/Readiness/Liveness/Dependency，六端以同一签名 Manifest 原子发布。流量按 1/10/50/100 门禁推进，每档核对 SLO、Provider 和业务不变量。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 必须证明 Schema/Role/RLS/合同/配置 Hash 一致，订单金额、库存、支付、账本、凭证、福利、Scope、Outbox/Inbox、报表 Watermark 和审计链均正确，六端 Smoke/深链/缓存 Head 无漂移。Data repair 仅使用已准备的前向修复、事件重放位点或领域补偿。Escalation 按 P0/P1 路由对应 Owner；Audit 归档每个 Gate 的输入 Hash、结果、Actor、时间、Trace 和签字。

## 回滚边界

Retire 前可恢复无破坏性应用版本、六端 Bundle、Extension 启用状态、CDN Head 和配置版本，并停止未完成迁移；已成功的支付、退款、核销、分录、发放和审批只能补偿/冲正。Voucher 硬切后只读止血并前向修复。Retire 是显式不可逆点，之后数据库只前进修复，不能启动旧写模型。

## 沟通模板

“发布 `{releaseId}`，阶段 `{stage}`，流量 `{percentage}`，影响 Scope `{scope}`，Gate `{gateResult}`，当前措施 `{containment}`，下一决策 `{decisionAt}`，Release Commander `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

所有声明式 Stage 与签字完成；四进程和六端版本一致；100% 流量观察窗无 SLO 燃尽；十项不变量、Provider、迁移和恢复证据通过；旧权限/Secret 租约/资源按计划退役；不可变证据包归档完成。

## 复盘链接（Postmortem）

门禁漏检、回滚、Retire 后修复、P0/P1、版本漂移或不变量异常必须填写 `{postmortemUrl}`，记录阶段时间线、决策、数据证据、恢复耗时、检测缺口和改进 Owner。
