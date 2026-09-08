# 运行数据清理运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

已过期的幂等记录、会话、终态任务元数据或临时对象超过容量水位，清理任务积压、Deadletter、锁等待或分类异常时触发。容量和查询延迟上升为 P1；任何未到期记录、非终态任务或业务事实进入候选集为 P0。清理不得触碰订单、支付、退款、核销、库存、权益、账务、发放、审批、审计、Outbox/Inbox 未完成记录等权威事实。

## Owner 与前置权限

Platform Owner 主责，Database、Security、各数据 Owner 协同。操作人仅获得保留目录、候选统计、引用关系和执行证据的最小权限；修改保留策略、扩大数据类别或执行补偿需要数据 Owner 与 Security 审批。命令参数使用 `{environment}`、`{class}`、`{before}`、`{batchSize}` 和 `{jobId}`，不得包含 Secret 或 PII。

## 只读诊断（Diagnosis）

读取生效的保留策略版本、数据分类、终态集合、最小保留期、Legal Hold、候选最早/最晚时间、数量、总字节、活动引用、租约、Checkpoint 和数据库锁。先运行 Dry-run，输出候选主键摘要、分类、边界、数量、Hash 与排除原因，不输出正文。逐类证明候选记录已经到期且属于允许清理的终态；任一记录状态未知或仍被活动会话、租约、幂等结果、任务、审计引用时，整批拒绝。

## 止血（Stop loss）

发现分类、终态、保留期、Scope、引用或 Hash 不确定时立即暂停对应数据类，不扩大批次、不手工删除、不改系统时间、不关闭外键/RLS/触发器。保留任务、Dry-run、查询计划和锁证据；若清理造成延迟，只降低批次与并发或暂停低优先级清理，不能跳过安全谓词。

## 恢复（Recovery）

修正版本化保留配置或终态判定后重新 Dry-run；正式任务必须引用同一 Dry-run Hash，使用稳定游标、小批量、短事务和幂等删除。每批提交前再次验证 `expired = true`、`terminal = true`、`legalHold = false`、`activeReferenceCount = 0`，并记录删除数量和边界。进程中断从已提交 Checkpoint 继续；锁等待或负载越界自动退避，不能无限重试。

## 数据核对（Data repair / Validation / Escalation / Audit）

严格证明未到期记录删除数为 0、非终态记录删除数为 0、Legal Hold 删除数为 0、跨 Scope 删除数为 0、业务事实删除数为 0。核对 Dry-run Hash、实际删除主键摘要、数量、边界、审计记录和 Checkpoint；抽查活动会话、租约、幂等最终结果、任务收据、Outbox/Inbox、审计引用仍可读取且语义不变。确认表增长、膨胀、锁等待和查询延迟回到容量目标。

## 回滚边界

Dry-run 和尚未提交的批次可取消。已正确删除且超过保留期的派生/运行元数据不恢复；误删必须按安全事件处理，从隔离备份恢复到临时表，核对合法性后通过受审计的前向修复重建最小数据，严禁直接覆盖生产表。权威业务事实不属于本清理流程，也不得以“可从备份恢复”为由加入范围。

## 沟通模板

“清理事件 `{incidentId}`，严重级 `{severity}`，数据类 `{class}`，策略版本 `{policyVersion}`，候选边界 `{before}`，Dry-run 数量 `{count}`，当前影响 `{impact}`，处置 `{containment}`，下一检查 `{nextCheck}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

保留分类和终态由数据 Owner 确认；Dry-run 与执行 Hash、数量和边界一致；未到期、非终态、Legal Hold、跨 Scope、业务事实删除数全部为 0；所有活动引用核对通过；负载恢复；失败批次与 Deadletter 处理完毕；审批及审计证据完整。

## 复盘链接（Postmortem）

误删、错误候选、跨 Scope、绕过保留、重复积压或数据库影响越过 SLO 必须填写 `{postmortemUrl}`，记录受影响类别、恢复来源、数据核对、控制缺口、修复 Owner 和到期日。
