# Qualification expiry

`qualificationexpiry` 在经营资质的 `expiresAt` 到达后，以案件版本作为幂等围栏，把仍处于已发布状态的案件转换为已到期并写入 `qualification.expired` Outbox 事件。

处理失败时由 Runtime Job 按统一退避策略重试；重复任务、旧版本任务、已撤销案件和尚未到期案件安全空操作。连续失败进入 `runtime.deadletters`，值班人员应先核对数据库连接、案件版本和 Outbox 外键，再重放同一任务，不得直接修改材料 Hash、案件版本或到期时间。

## Trigger, impact and owner

Trigger 是已发布资质到达 `expiresAt`；Impact 是不合规 Listing 可能继续可售。Qualification Owner 主责，Catalog、Risk 与合规 Owner 协同下架和取证。

## Stop loss and diagnosis

Stop loss 先通过权威资格决策阻断受影响 Listing，不删除案件或材料。Diagnosis 核对 Job lease、案件版本、材料 Hash、Scope、时钟、资格决策、Listing 状态及 Outbox/Inbox。

## Recovery and data repair

Recovery 复用原 Job 与案件版本；Data repair 只允许经审批的前向事件重放或投影重建，禁止延长到期时间、替换材料 Hash 或手改 Listing。

## Validation, escalation and audit

Validation 覆盖案件 expired、消费端不可购、重复执行无副作用、Outbox 与决策版本一致。Escalation 包括跨租户、已过期仍可售、误下架和证据缺失。Audit 保存案件/Listing、前后版本、Job/Event/Trace 和验证结果。

## Postmortem

任何合规暴露、错误阻断或 SLO 超限都要完成 Postmortem，明确根因、影响时窗与整改 Owner。
