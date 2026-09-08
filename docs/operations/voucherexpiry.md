# 卡券到期运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

到期 Job 延迟、已过期 Voucher 仍可核销、活动 Hold 跨过有效期、未释放价值、退款规则冲突或 Deadletter 时触发。仅投影延迟为 P1；过期后成功核销、重复释放或财务不平为 P0。

## Owner 与前置权限

Voucher Owner 主责，Payment、Finance、Runtime 与 Customer Support 协同。任务使用数据库时间、规则版本、Lease/Fencing 与稳定 VoucherId；人工延期/恢复需要权限、Step-up、原因和必要审批，不能改系统时间。

## 只读诊断（Diagnosis）

核对有效期、Product/Pool 时区规则、状态、Holder、活动/已确认/已释放 Hold、Redemption、Refund、余额、Finance Reference、Job Cursor/Checkpoint 和事件。确认命令时到期校验独立于投影，避免缓存误判。

## 止血（Stop loss）

在核销命令层拒绝所有已过期 Voucher；暂停异常分区的自动过期，保留其他分区。对跨期 Hold 停止新捕获并查询原支付/核销结果；禁止删除 Hold、延长全部卡券或手工改状态。

## 恢复（Recovery）

Worker 以原 JobId 从 Checkpoint 继续，锁定 Voucher 后重读到期和 Hold。无活动 Hold 时追加 expired 事件并释放未用价值；有活动 Hold 时按冻结规则完成、释放或转人工接管。合法延期创建新版本化动作，不改原到期历史；退款按原 Redemption 和剩余可退价值处理。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 证明到期候选全覆盖、重复执行无额外事件/价值变化、过期核销成功数为 0、Hold/Refund/Finance 守恒。Data repair 通过延期、释放、Refund 或冲正；Escalation 对过期核销/价值不平 P0；Audit 保存规则版本、数据库时间、前后状态和 Receipt。

## 回滚边界

未执行候选可暂停；到期事实不删除，合法恢复通过有期限的新动作；已核销/退款/分录不回退，只补偿/冲正。

## 沟通模板

“卡券到期事件 `{incidentId}`，Scope `{scope}`，候选/完成/持有 `{total}/{expired}/{held}`，核销/资金影响 `{impact}`，人工接管 `{manualOwner}`，证据 `{evidenceRef}`。”

## 关闭条件

Cursor 追平数据库时间；命令时拒绝有效；所有 Hold 有结论；到期、余额、Refund、Finance 和事件核对通过；过期成功核销为 0；告警恢复。

## 复盘链接（Postmortem）

过期核销、重复释放、时区/规则错误、资金不平或积压越界必须填写 `{postmortemUrl}`。
