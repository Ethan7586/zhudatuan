# 结算与提现运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

Settlement 批次停滞、输入 Watermark 漂移、净额不守恒、Withdrawal 外部成功本地 Unknown、Hold/恢复异常或 Deadletter 时触发。合作方延迟收款为 P1；重复付款、超额提现、账务不平或错账户为 P0。

## Owner 与前置权限

Finance Owner 主责，Approval、Partner、Payment Provider、Database 与 Security 协同。批次冻结账期、Statement/Reconciliation Watermark、应收/费用/调整/净额、账户版本和审批 Proof；经办与复核/付款人职责分离，外部请求使用稳定业务号。

## 只读诊断（Diagnosis）

核对 Period 是否允许结算、Reconciliation 是否完成、Journal 借贷、Settlement 输入 Hash、Adjustment、Hold、Withdrawal Intent/Attempt、外部业务号/查询结果、Invoice Basis、Job Checkpoint 和审计。外部超时一律视为 Unknown，不重新付款。

## 止血（Stop loss）

冻结受影响 Settlement/Account 的新提现和发票，保持已确认付款事实；撤销未消费 Proof，隔离错误账户/配置。禁止改净额、余额、Journal 或用新业务号重复支付。

## 恢复（Recovery）

重试复用同一 SettlementId/WithdrawalId/外部业务号；Unknown 先 Provider Query，确认成功后幂等补录本地 Receipt，确认失败才允许同 Attempt 规则重试。Hold 只能由批准原因创建/释放；恢复后继续原 Checkpoint。错误金额通过 Adjustment/Reverse 新事实修复。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 证明 `gross - fees + adjustments - holds = net`、累计 Withdrawal 不超可提、一次外部业务号最多一次成功、账户/币种正确、Journal 平衡、Proof 单次消费。Data repair 仅 Adjustment/Reverse；Escalation 重复付款/不平 P0；Audit 保存输入 Hash、查询/付款 Receipt 与审批链。

## 回滚边界

未提交批次/付款可取消；已成功付款、Journal 和审批不回退，只冲正或追偿。已关闭账期不直接重开，遵循受控 Reopen/Adjustment。

## 沟通模板

“结算事件 `{incidentId}`，账期/批次 `{period}/{settlementId}`，净额 `{netMinor} {currency}`，付款状态 `{withdrawalState}`，影响 `{impact}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

输入 Watermark 与 Hash 冻结；金额公式、Journal、账户和 Proof 通过；所有 Unknown 有 Provider 结论；重复付款为 0；Hold/Invoice 后续状态明确；告警恢复。

## 复盘链接（Postmortem）

重复/错付、超额提现、账务不平、职责分离失效或 SLO 违约必须填写 `{postmortemUrl}`。
