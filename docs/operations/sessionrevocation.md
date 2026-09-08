# 权限版本会话撤销

## Trigger, impact and owner

Trigger：`sessionrevocation` 消费 `access.version.changed`。Impact：在权限收回后，旧会话可能短暂保留过期能力。Owner：Identity 值班负责人主责，Access 与 Security 负责人协同。

## Stop loss and diagnosis

Stop loss：仅暂停异常成员对应的重试，禁止停用全局鉴权或手工放宽权限。Diagnosis：核对 Job、Event、Membership、AccessVersion、Session、Inbox 与 Trace；只查看脱敏标识，不读取凭据。

## Recovery and data repair

任务仅撤销目标成员权限版本以前的未结束会话。事件通过 Runtime Inbox 去重；撤销与 Inbox 完成在同一数据库事务中提交，并发布 `identity.session.revoked`。恢复依赖后，由统一 Job Runner 按退避策略重试；超过上限进入 `runtime.deadletters`。Data repair 必须通过受审计的事件重放或前向修复任务完成，不得手工修改会话版本、跳过 Inbox 或伪造事件。

## Validation, escalation and audit

Validation：确认旧 Session 全部结束、新版本 Session 不受影响、Inbox 仅消费一次、撤销事件数量与目标会话一致，并抽查 Scope 与权限立即收敛。Escalation：跨租户影响、版本倒退、重复撤销或证据不完整时立即升级 Security、Access 与事件平台负责人。Audit：保存 Job ID、Event ID、目标成员脱敏标识、前后 AccessVersion、撤销数量、Trace、重试与验证结果。

## Postmortem

发生越权窗口、跨范围撤销、永久死信或 SLO 超限时必须完成 Postmortem，记录 Trigger、Impact、根因、Stop loss、Recovery 时长、Data repair、Validation 证据、改进 Owner 与截止日期。
