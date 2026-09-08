# 卡券生命周期批量操作运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

激活、绑定、解绑、停用、恢复、延期或作废批次停滞，状态冲突、活动 Hold、退款/核销不一致或 Deadletter 时触发。成功 Item 保持已提交；非法恢复已核销/已作废卡券、重复转换或价值异常为 P0。

## Owner 与前置权限

Voucher Owner 主责，Finance、Payment、Approval、Security 与 Runtime 协同。批量动作必须包含原因、目标集合 Hash、ExpectedVersion；停用/恢复/延期/作废等高风险动作需要 Step-up，超额度需审批。操作者不能绕过 Holder/Scope 和职责分离。

## 只读诊断（Diagnosis）

核对动作、Batch/Item、前后状态、VoucherProduct 规则版本、持有人、有效期、活动 Hold、Redemption/Refund 累计价值、Finance Reference、Job Checkpoint 和事件历史。确认每项合法状态转换；不读取 Credential Secret。

## 止血（Stop loss）

暂停受影响批次和同一 Voucher 的竞争批次；命令时继续按权威状态/有效期拒绝核销。禁止直接 SQL 更新状态、删除历史、强行解除 Hold 或把失败 Item 标成功。可能错发/Secret 暴露转安全事件。

## 恢复（Recovery）

按原 BatchId/ItemId 幂等重试失败且 retryable 的 Item，每项独立锁定和提交，已成功项只回读 Receipt。恢复只允许从 `disabled` 回到其规则允许状态；延期不能作用于 redeemed/voided；作废前处理 Hold 与可退款价值。复杂冲突进入人工接管，由审批后的单项领域 Operation 处理。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 核对 `requested = succeeded + failed`、状态机合法、每成功项一个不可变事件、Hold/核销/退款/余额守恒、Secret 不暴露。Data repair 用反向生命周期动作或 Refund/Accounting Correction，不改历史。Escalation 对双转换、价值不守恒或跨 Scope P0；Audit 保存 Actor/Reason/Proof/前后版本/Receipt。

## 回滚边界

未执行 Item 可取消；已提交动作不删除。激活/停用可按规则产生新恢复动作，作废和已核销不可回退；退款与账务只能前向补偿/冲正。

## 沟通模板

“卡券状态批次 `{batchId}`，动作 `{action}`，进度 `{succeeded}/{total}`，冲突 `{failed}`，Hold/退款影响 `{impact}`，人工接管 `{manualOwner}`，证据 `{evidenceRef}`。”

## 关闭条件

所有 Item 有终态/人工 Owner；状态机、事件、Hold、Redemption、Refund、Finance 数量价值核对通过；无 Secret/跨 Scope；告警恢复。

## 复盘链接（Postmortem）

非法恢复、双转换、价值错误、Secret 泄露或批次 SLO 违约必须填写 `{postmortemUrl}`。
