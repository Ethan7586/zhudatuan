# 支付未知结果恢复运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

支付提交超时、回调丢失/乱序/迟到、PaymentIntent 长时间 Unknown、Provider 查询不一致或查询 Job 进入 Deadletter 时触发。用户看到“支付结果确认中”；重复扣款、已付款未确认导致重复支付、错误释放库存/权益为 P0。

## Owner 与前置权限

Payment Owner 主责，Order、Inventory、Benefit、Voucher、Finance、Provider 与 Support 协同。查询使用原 PaymentIntent/Attempt、稳定外部业务号和最小只读 Provider 凭据；人工结论需要 Step-up、证据和双人复核。不得向用户索要支付密钥或完整交易敏感信息。

## 只读诊断（Diagnosis）

核对 Intent/Attempt 状态机、Order 应付与 Allocation、幂等键、外部业务号、提交 Receipt、回调签名/Nonce/Inbox、Provider Query、库存/权益/Voucher Hold、超时/取消 Job 和 Finance Journal。按 Provider 时间线排序，终态不得被迟到消息逆转。

## 止血（Stop loss）

同一 Intent 禁止再次扣款；保留 Hold 至恢复策略到期，限制用户重复点击并显示可回读状态。签名异常隔离回调并进入安全事件；只暂停受影响 Provider/连接，其他支付方式继续。禁止手工改 paid/failed 或提前释放所有资源。

## 恢复（Recovery）

以原外部业务号执行 Provider Query；`succeeded` 幂等捕获并推进 Order，`failed` 按规则释放 Hold，仍 Unknown 按退避继续且不新建 Attempt。迟到合法回调经过签名/Inbox 防重后进入同一状态机。超出自动时限转人工接管，记录 Provider 证明后用受控 Recovery Operation 得出结论。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 核对 Order 应付、Payment Allocation、Provider 成功金额、库存/权益/Voucher Hold、Journal 与事件，证明一个 Intent 最多一次 Capture、终态单调、迟到回调无逆转。Data repair 只补录真实外部结果或领域补偿；Escalation 重复扣款/金额错 P0；Audit 保存签名验证、查询回执 Hash、Actor 和 Trace。

## 回滚边界

Unknown 可继续查询；已确认成功不能改失败，只能退款；已确认失败收到真实迟到成功时按状态机捕获并通知，不能丢弃。已释放资源按领域补偿重新处理，禁止数据库回滚支付事实。

## 沟通模板

“支付恢复 `{incidentId}`，Intent `{intentId}`，Provider `{provider}`，当前 `{state}`，用户/订单影响 `{impact}`，查询计划 `{nextQuery}`，人工接管 `{manualOwner}`，证据 `{evidenceRef}`。”

## 关闭条件

所有 Unknown 达到 Provider 可证明终态或有明确人工 Owner；金额、Order、Hold、Journal、回调/Inbox 核对通过；重复扣款为 0；用户状态与通知更新；告警恢复。

## 复盘链接（Postmortem）

重复扣款、错误终态、迟到回调破坏、金额/资源不守恒或 Unknown 超 SLA 必须填写 `{postmortemUrl}`。
