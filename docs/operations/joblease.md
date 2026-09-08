# Worker 租约运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

同一 Job 出现多个活动租约、Fencing Token 拒绝、续租持续失败、任务重复副作用、Worker 时钟/数据库故障或任务长时间无 Checkpoint 时触发。仅延迟为 P1；支付、库存、发券、核销或账务发生重复效果为 P0。

## Owner 与前置权限

Runtime Owner 主责，Database、Reliability 与业务 Job Owner 协同。诊断仅需 Job、Lease、Checkpoint、Outbox/Inbox 和审计只读权限；暂停队列、撤销租约或重放需要双人批准。禁止手工修改 Fencing Token、业务状态或数据库时钟。

## 只读诊断（Diagnosis）

按 `{environment}`、`{queue}`、`{jobId}` 读取 Job 状态、当前/历史租约、Owner、Token、过期时间、Worker 心跳、尝试次数、Checkpoint、幂等键、Outbox/Inbox 和副作用收据。对比数据库权威时间和 Worker 时间，确认是否为慢任务、失联 Worker、数据库切换或重复调度。

## 止血（Stop loss）

暂停受影响 Job Kind 或分区的新 Claim，保留健康队列；隔离失联 Worker，等待其租约自然过期并由数据库颁发更高 Token。外部调用结果未知时停止重试并转领域查询恢复。不得删除租约、降低 Token、把运行中任务直接改成功或全局停止无关 Worker。

## 恢复（Recovery）

新 Worker 只能以更高 Fencing Token 从最后已提交 Checkpoint Claim；每次状态写、Checkpoint 和副作用提交必须校验 Token。已提交副作用由幂等键/Inbox/业务唯一约束回读，不重复调用；可恢复错误按 Job Catalog 退避，越过尝试上限进入 Deadletter。

## 数据核对（Data repair / Validation / Escalation / Audit）

证明一个 Job 同时只有一个可写租约；旧 Token 写入全部失败；Checkpoint 单调；状态单调；同幂等键的订单、支付、库存、凭证、通知或 Provider 调用效果最多一次。比较任务输入 Hash、收据、业务事实、Outbox/Inbox 和审计记录。

## 回滚边界

可撤销尚未 Claim 的调度与暂停策略；已提交 Checkpoint 不后退，已完成副作用不直接回滚。错误业务事实通过所属领域补偿/冲正；租约故障只修复调度，不篡改业务聚合。

## 沟通模板

“租约事件 `{incidentId}`，队列 `{queue}`，Job `{jobId}`，严重级 `{severity}`，当前 Token `{token}`，最后 Checkpoint `{checkpoint}`，影响 `{impact}`，止血 `{containment}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

唯一可写租约、Token 单调和续租恢复；积压回到 SLO；所有受影响 Job 从正确 Checkpoint 完成或进入有 Owner 的 Deadletter；重复效果核对为 0；证据和审批归档。

## 复盘链接（Postmortem）

重复副作用、Token 绕过、租约风暴或积压越过 SLO 必须填写 `{postmortemUrl}`，记录根因、容量/时钟/数据库因素、修复和负载验证。
