# 卡券发放运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

StockRequest/IssueOrder 审批后未建 IssueBatch、批次停滞、Credential 不足、重复分配、Finance/Notification/Outbox 不一致或 Secret 暴露时触发。部分用户未收到但事实完整为 P1；重复卡券、卡密错发、账务不平或跨客户泄露为 P0。

## Owner 与前置权限

Voucher Owner 主责，Approval、Finance、Benefit、Notification、Security 与 Runtime 协同。IssueOrder 必须绑定冻结的 VoucherProduct/Pool、客户清单 Hash、StockRequest、审批 Proof、数量/面值/币种和 ExpectedVersion；申请人不能审批。任何人不得读取未授权 Credential Secret。

## 只读诊断（Diagnosis）

依次核对 Product/Pool 可发状态、StockRequest 可用量、IssueOrder 与审批 Proof、IssueBatch/Item 计数、Job Lease/Fencing/Checkpoint、Credential 锁与 Blind Fingerprint、Voucher、Finance Reference、Notification Receipt、Outbox/Inbox。只显示掩码编号、稳定错误码和 Trace，不输出卡密/Ciphertext。

## 止血（Stop loss）

暂停受影响 IssueBatch 的新分片并冻结可疑 Pool 分配，保留已成功 Item；禁止整批重跑、手工改计数或重新分配 Credential。Secret/错发时撤销一次性下载、隔离通道并进入 `securityincident.md`；未确认的通知不能标记送达。

## 恢复（Recovery）

以原 BatchId/ItemId/Idempotency Key 从 Checkpoint 只重试 retryable Item。每项锁定一个 available Credential，创建一个 Voucher 和稳定 Receipt，Finance 与 `voucher.issued` 事件幂等提交；外部通知失败不回滚已发事实，只重放 Dispatch。无法自动确认的项进入人工接管队列，由双人核对后补发、作废或退款。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 证明 `requested = succeeded + failed + pending`，IssueOrder/Batch/Item/Credential/Voucher/Finance/Event/Notification 一一对应，Credential 只分配一次，金额/库存守恒，卡密未泄露。Data repair 通过批准的 replacement/void/refund/accounting correction 前向事实；Escalation 对重复、泄露、不平 P0；Audit 保存 Proof、Hash 与 Receipt。

## 回滚边界

未分配 Item 可取消；已发 Voucher 不删除或重新分配，通过停用/作废/退款并保留原历史。已发送 Secret 不能“收回”，必须风险处置、替换和通知；账务只冲正。

## 沟通模板

“发放批次 `{batchId}`，订单 `{issueOrderId}`，进度 `{succeeded}/{total}`，失败/待人工 `{failed}/{manual}`，用户/资金影响 `{impact}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

所有 Item 终态或明确人工 Owner；数量、Credential、Voucher、Finance、Event、Receipt 核对通过；重复/跨客户/泄露为 0；一次性下载和通道状态正确；告警与审计关闭。

## 复盘链接（Postmortem）

重复发放、Secret 暴露、账务不平、跨客户或批次 SLO 违约必须填写 `{postmortemUrl}`。
