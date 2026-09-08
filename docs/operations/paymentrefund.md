# 支付退款运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

退款提交超时、Provider 结果 Unknown、迟到回调、部分退款金额冲突、重复退款、售后/库存/权益/佣金冲正不一致或 Deadletter 时触发。退款延迟为 P1；超额/重复退款、错收款人、账务不平为 P0。

## Owner 与前置权限

Payment Owner 主责，Order/AfterSale、Fulfillment、Inventory、Benefit、Voucher、Finance、Provider 与 Support 协同。RefundIntent 必须绑定原 Capture、可退金额快照、原因、售后/收货/质检证据、ExpectedVersion 与审批 Proof；外部请求复用稳定退款业务号。

## 只读诊断（Diagnosis）

核对原 Payment Allocation、累计 succeeded/pending Refund、RefundIntent/Attempt、Provider 业务号/Query/Callback、售后数量与质检、Inventory Movement、Benefit/Voucher 恢复、佣金/Journal 冲正、Outbox/Inbox。Provider 超时视为 Unknown，不创建第二退款。

## 止血（Stop loss）

冻结同 Capture 的新退款额度，保持其他订单可用；Unknown 只查询，不重提。签名/收款人/金额异常隔离连接并停止相关 Finance 写。禁止改退款成功、删除 Attempt 或先恢复权益再确认政策条件。

## 恢复（Recovery）

以原 RefundIntent/业务号查询 Provider；成功则幂等记录 Receipt 并按冻结分摊比例推进订单、库存、权益、Voucher、佣金和 Journal，失败才释放额度并允许规则内重试。迟到回调经 Inbox 进入同一状态机；复杂差异转人工接管和审批修复。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 证明 `succeeded + pending <= captured refundable`，部分退款数量/金额/税费/分摊与售后一致，外部与 Journal 金额相等，权益/Voucher/库存按规则恢复且不重复。Data repair 只补录真实结果或冲正；Escalation 超额/重复 P0；Audit 保存 Proof、回执 Hash 和时间线。

## 回滚边界

未提交 RefundIntent 可取消；Provider 已成功退款不能回退，通过新的收费业务流程处理，不修改原退款。Journal、权益、库存均追加补偿事实，不能删除历史。

## 沟通模板

“退款恢复 `{incidentId}`，Refund `{refundId}`，Capture `{paymentId}`，金额 `{amountMinor}`，Provider 状态 `{state}`，用户影响 `{impact}`，人工接管 `{manualOwner}`，证据 `{evidenceRef}`。”

## 关闭条件

所有 Unknown 有终态/Owner；金额与累计可退守恒；售后、库存、权益、Voucher、佣金、Journal、通知一致；重复/超额退款为 0；告警恢复。

## 复盘链接（Postmortem）

重复/超额/错人退款、状态逆转、账务不平或 Provider Unknown 超 SLA 必须填写 `{postmortemUrl}`。
